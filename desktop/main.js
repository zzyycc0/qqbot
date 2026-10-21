const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, shell, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const net = require('net');
const { spawn } = require('child_process');
const { Client } = require('ssh2');

const APP_DIR = __dirname;
const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');

const DEFAULTS = {
  host: '',
  port: 22,
  user: 'root',
  keyPath: '',
  uin: '',
  backupDir: path.join(os.homedir(), 'QQ陪伴备份'),
  napcatCache: '/root/Napcat/opt/QQ/resources/app/app_launcher/napcat/cache/qrcode.png',
};

function loadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8').replace(/^\uFEFF/, '');
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}
function saveConfig(cfg) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
}

// ---------- SSH ----------
let conn = null;
let connecting = null;

function closeConn() {
  try { if (conn) conn.end(); } catch {}
  conn = null;
}

function connect() {
  if (conn) return Promise.resolve(conn);
  if (connecting) return connecting;
  const cfg = loadConfig();
  connecting = new Promise((resolve, reject) => {
    const c = new Client();
    let done = false;
    const fail = (e) => {
      if (conn === c) conn = null;
      if (!done) { done = true; reject(e); }
    };
    c.on('ready', () => {
      conn = c;
      done = true;
      c.on('close', () => { if (conn === c) conn = null; });
      c.on('error', () => { if (conn === c) conn = null; });
      resolve(c);
    });
    c.on('error', fail);
    try {
      c.connect({
        host: cfg.host,
        port: Number(cfg.port) || 22,
        username: cfg.user,
        privateKey: fs.readFileSync(cfg.keyPath),
        readyTimeout: 25000,
        keepaliveInterval: 15000,
      });
    } catch (e) {
      fail(e);
    }
  }).finally(() => { connecting = null; });
  return connecting;
}

function stripAnsi(s) {
  return String(s || '').replace(/\u001b\[[0-9;]*m/g, '');
}

function exec(cmd, timeoutMs = 40000) {
  return connect().then((c) => new Promise((resolve, reject) => {
    let out = '';
    let err = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) { settled = true; try { stream.destroy(); } catch {} reject(new Error('命令超时')); }
    }, timeoutMs);
    const stream = c.exec(cmd, (e, s) => {
      if (e) { clearTimeout(timer); settled = true; return reject(e); }
      s.on('data', (d) => { out += d.toString('utf8'); });
      s.stderr.on('data', (d) => { err += d.toString('utf8'); });
      s.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ code, out, err });
      });
    });
  })).catch((e) => {
    if (/超时|timed out|Timeout|ECONN|Not connected|No response/i.test(String(e && e.message || e))) {
      closeConn();
    }
    throw e;
  });
}

function sftpRead(remotePath) {
  return connect().then((c) => new Promise((resolve, reject) => {
    c.sftp((e, sftp) => {
      if (e) return reject(e);
      sftp.readFile(remotePath, (e2, data) => (e2 ? reject(e2) : resolve(data)));
    });
  }));
}
function sftpWrite(remotePath, content) {
  return connect().then((c) => new Promise((resolve, reject) => {
    c.sftp((e, sftp) => {
      if (e) return reject(e);
      sftp.writeFile(remotePath, content, (e2) => (e2 ? reject(e2) : resolve()));
    });
  }));
}
function sftpDownload(remotePath, localPath) {
  return connect().then((c) => new Promise((resolve, reject) => {
    c.sftp((e, sftp) => {
      if (e) return reject(e);
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
      sftp.fastGet(remotePath, localPath, {}, (e2) => (e2 ? reject(e2) : resolve(localPath)));
    });
  }));
}

// ---------- status ----------
const STATUS_CMD = [
  'echo "@@SVC"',
  'systemctl is-active qqb-napcat',
  'systemctl is-active qqb-astrbot',
  'systemctl is-active qqb-gateway',
  'echo "@@ENABLED"',
  'systemctl is-enabled qqb-napcat',
  'systemctl is-enabled qqb-astrbot',
  'systemctl is-enabled qqb-gateway',
  'echo "@@MEM"',
  "free -m | awk '/Mem:/{print $2,$3,$4} /Swap:/{print $2,$3}'",
  'echo "@@DISK"',
  "df -h / | awk 'NR==2{print $2,$3,$4,$5}'",
  'echo "@@LOAD"',
  "awk '{print $1,$2,$3}' /proc/loadavg",
  'echo "@@UP"',
  'uptime -p',
  'echo "@@QQ"',
  'pgrep -fc "/root/Napcat/opt/QQ/qq --no-sandbox" || echo 0',
  'echo "@@ADAPTER"',
  'tail -n 500 /root/astrbot.log | grep -a "适配器已连接" | tail -1',
  'echo "@@NAPCAT"',
  'tail -n 500 /root/napcat.log | grep -aE "登录成功|正在快速登录|二维码已被扫描|网络已连接|二维码已保存" | tail -1',
  'echo "@@PORTS"',
  "ss -lnt 2>/dev/null | grep -oE ':(6198|6185|6190|6199|6099)' | sort -u | tr '\\n' ' '",
  'echo "@@TIMER"',
  'systemctl is-active qqb-backup.timer',
  'echo "@@IP"',
  'curl -s --max-time 4 https://ifconfig.me || hostname -I',
  'echo "@@END"',
].join('\n');

function parseStatus(text) {
  const sec = (name) => {
    const m = text.split('@@' + name)[1];
    if (!m) return '';
    return m.split('@@')[0].trim();
  };
  const svc = sec('SVC').split('\n').map((s) => s.trim());
  const enabled = sec('ENABLED').split('\n').map((s) => s.trim());
  const mem = sec('MEM').split('\n').map((s) => s.trim());
  const disk = sec('DISK').trim().split(/\s+/);
  const load = sec('LOAD').trim().split(/\s+/);
  return {
    napcatActive: svc[0] === 'active',
    astrbotActive: svc[1] === 'active',
    gatewayActive: svc[2] === 'active',
    napcatEnabled: enabled[0] === 'enabled',
    astrbotEnabled: enabled[1] === 'enabled',
    gatewayEnabled: enabled[2] === 'enabled',
    memTotal: Number(mem[0]?.split(' ')[0] || 0),
    memUsed: Number(mem[0]?.split(' ')[1] || 0),
    memFree: Number(mem[0]?.split(' ')[2] || 0),
    swapTotal: Number(mem[1]?.split(' ')[0] || 0),
    swapUsed: Number(mem[1]?.split(' ')[1] || 0),
    diskTotal: disk[0] || '', diskUsed: disk[1] || '', diskFree: disk[2] || '', diskPct: disk[3] || '',
    load1: load[0] || '', load5: load[1] || '', load15: load[2] || '',
    uptime: stripAnsi(sec('UP')).trim(),
    qqProcs: parseInt(sec('QQ').trim(), 10) || 0,
    adapterLine: stripAnsi(sec('ADAPTER')).trim(),
    napcatLine: stripAnsi(sec('NAPCAT')).trim(),
    ports: stripAnsi(sec('PORTS')).trim(),
    backupTimer: stripAnsi(sec('TIMER')).trim(),
    publicIp: stripAnsi(sec('IP')).trim().split('\n').pop() || '',
  };
}

// ---------- window & tray ----------
let win = null;
let tray = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1060,
    height: 760,
    minWidth: 900,
    minHeight: 640,
    title: 'QQ 陪伴 · 控制台',
    backgroundColor: '#0f1117',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(APP_DIR, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(APP_DIR, 'renderer', 'index.html'), { query: { tab: 'overview' } });
  win.webContents.on('console-message', (e, level, message, line, sourceId) => {
    try {
      const msg = (e && e.message) || message;
      fs.appendFileSync(path.join(APP_DIR, 'renderer.log'), `[${new Date().toLocaleTimeString()}] ${msg} (${sourceId || ''}:${line || ''})\n`);
    } catch {}
  });
  win.on('close', (e) => {
    if (!app.isQuitting) { e.preventDefault(); win.hide(); }
  });
  win.on('closed', () => { win = null; });
}

function trayIcon() {
  const p = path.join(APP_DIR, 'assets', 'tray.png');
  try { return nativeImage.createFromPath(p); } catch { return nativeImage.createEmpty(); }
}

function createTray() {
  tray = new Tray(trayIcon());
  tray.setToolTip('QQ 陪伴');
  const menu = Menu.buildFromTemplate([
    { label: '打开控制台', click: () => { if (!win) createWindow(); win.show(); win.focus(); } },
    { type: 'separator' },
    { label: '退出控制台', click: () => { app.isQuitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu);
  tray.on('click', () => { if (!win) createWindow(); win.show(); win.focus(); });
}

app.whenReady().then(() => {
  createWindow();
  try { createTray(); } catch (e) { console.error('tray error', e); }
  app.on('activate', () => { if (!win) createWindow(); win.show(); });
});
app.on('window-all-closed', () => {});
app.on('before-quit', () => {
  app.isQuitting = true;
  try { if (panelProc) panelProc.kill(); } catch {}
});

// ---------- IPC ----------
ipcMain.handle('cfg:get', () => loadConfig());
ipcMain.handle('cfg:save', (_e, cfg) => { saveConfig({ ...loadConfig(), ...cfg }); return loadConfig(); });

ipcMain.handle('ssh:test', async () => {
  try {
    const r = await exec('echo OK; hostname; uptime -p');
    return { ok: true, text: r.out.trim() };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

ipcMain.handle('status:get', async () => {
  try {
    const r = await exec(STATUS_CMD, 45000);
    const st = parseStatus(r.out);
    st.ok = true;
    return st;
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

ipcMain.handle('gateway:status', async () => {
  try {
    const r = await exec('curl -s --max-time 6 http://127.0.0.1:6198/status', 15000);
    return { ok: true, status: JSON.parse(r.out) };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

ipcMain.handle('gateway:usage', async () => {
  try {
    const r = await exec('curl -s --max-time 8 http://127.0.0.1:6198/usage', 15000);
    return { ok: true, usage: JSON.parse(r.out) };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

ipcMain.handle('logs:get', async (_e, source) => {
  const files = {
    napcat: '/root/napcat.log',
    astrbot: '/root/astrbot.log',
    gateway: '/opt/qqb/logs/gateway.log',
  };
  try {
    let cmd;
    if (source === 'system') {
      cmd = 'journalctl -n 220 --no-pager -u qqb-napcat -u qqb-astrbot -u qqb-gateway -u qqb-backup.timer 2>/dev/null';
    } else {
      cmd = `tail -n 250 ${files[source] || files.napcat}`;
    }
    const r = await exec(cmd, 30000);
    return { ok: true, text: stripAnsi(r.out) };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

// ---------- 诊断 ----------
const DIAG_SCRIPT = String.raw`
import json, socket, subprocess, os, shutil
def sh(cmd):
    try:
        return subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=8).stdout.strip()
    except Exception:
        return ""
def port_open(p):
    s = socket.socket(); s.settimeout(1)
    try:
        s.connect(("127.0.0.1", p)); return True
    except Exception:
        return False
    finally:
        s.close()
checks = []
for unit, label in [("qqb-napcat","NapCat"),("qqb-astrbot","AstrBot"),("qqb-gateway","模型网关")]:
    active = sh(f"systemctl is-active {unit}") == "active"
    enabled = sh(f"systemctl is-enabled {unit}") == "enabled"
    checks.append({"name": label+" 服务", "ok": active, "detail": ("运行中" if active else "已停止") + ("" if enabled else "，未设置开机自启")})
qq = int(sh("pgrep -fc '/root/Napcat/opt/QQ/qq --no-sandbox'") or 0)
checks.append({"name":"QQ 进程", "ok": qq > 0, "detail": f"{qq} 个进程"})
adapter = "适配器已连接" in sh("tail -n 800 /root/astrbot.log | grep -a 适配器已连接 | tail -1")
checks.append({"name":"消息通道", "ok": adapter, "detail": "AstrBot 已连上 NapCat" if adapter else "未发现连接记录"})
for p, label in [(6198,"模型网关"),(6185,"AstrBot 管理"),(6190,"陪伴面板"),(6199,"OneBot WS")]:
    ok = port_open(p)
    checks.append({"name": label+" 端口", "ok": ok, "detail": f"127.0.0.1:{p} " + ("监听中" if ok else "未监听")})
try:
    import urllib.request
    with urllib.request.urlopen("http://127.0.0.1:6198/health", timeout=4) as r:
        ok = json.loads(r.read().decode()).get("ok") is True
    checks.append({"name":"网关健康检查", "ok": ok, "detail":"/health 正常" if ok else "返回异常"})
except Exception as e:
    checks.append({"name":"网关健康检查", "ok": False, "detail": str(e)[:80]})
disk = shutil.disk_usage("/")
pct = round(disk.used / disk.total * 100, 1)
checks.append({"name":"磁盘空间", "ok": pct < 88, "detail": f"已用 {pct}%，剩余 {round(disk.free/1024**3,1)}G"})
timer = sh("systemctl is-active qqb-backup.timer") == "active"
checks.append({"name":"自动备份", "ok": timer, "detail":"每天 04:00" if timer else "定时器未启用"})
try:
    cfg = json.load(open("/opt/qqb/data/model_config.json", encoding="utf-8"))
    bad = [m.get("id") for m in cfg.get("models", []) if not m.get("api_key")]
    checks.append({"name":"模型配置", "ok": not bad, "detail":"配置可读" if not bad else "缺少 Key: " + ",".join(bad)})
except Exception as e:
    checks.append({"name":"模型配置", "ok": False, "detail": str(e)[:80]})
print(json.dumps({"ok": all(c["ok"] for c in checks), "checks": checks}, ensure_ascii=False))
`;

ipcMain.handle('diag:run', async () => {
  try {
    const b64 = Buffer.from(DIAG_SCRIPT, 'utf8').toString('base64');
    const r = await exec(`echo ${b64} | base64 -d | python3 -`, 45000);
    return { ok: true, diag: JSON.parse(r.out) };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

// ---------- 远程备份 ----------
ipcMain.handle('backup:remoteList', async () => {
  try {
    const r = await exec("ls -l --time-style=+%Y-%m-%dT%H:%M:%S /root/backups/qqb-*.tar.gz 2>/dev/null | awk '{print $5,$6,$7}' | tail -12", 20000);
    const files = stripAnsi(r.out).trim().split('\n').filter(Boolean).map((line) => {
      const parts = line.split(/\s+/);
      return { sizeMB: (Number(parts[0]) / 1024 / 1024).toFixed(1), mtime: parts[1] || '', name: (parts[2] || '').split('/').pop() };
    }).filter((x) => x.name).reverse();
    const t = await exec('systemctl is-active qqb-backup.timer', 10000);
    return { ok: true, files, timer: stripAnsi(t.out).trim() };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

ipcMain.handle('backup:download', async (_e, name) => {
  try {
    if (!/^qqb-[\w.-]+\.tar\.gz$/.test(name)) return { ok: false, error: '文件名不合法' };
    const cfg = loadConfig();
    const local = path.join(cfg.backupDir, name);
    await sftpDownload('/root/backups/' + name, local);
    const st = fs.statSync(local);
    return { ok: true, local, sizeMB: (st.size / 1024 / 1024).toFixed(1) };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

ipcMain.handle('svc:action', async (_e, { unit, action }) => {
  const units = { napcat: 'qqb-napcat', astrbot: 'qqb-astrbot', gateway: 'qqb-gateway' };
  const u = units[unit];
  if (!u) return { ok: false, error: '未知服务' };
  if (!['start', 'stop', 'restart'].includes(action)) return { ok: false, error: '未知操作' };
  try {
    const r = await exec(`systemctl ${action} ${u}; sleep 2; systemctl is-active ${u}`, 120000);
    return { ok: true, text: stripAnsi(r.out).trim() };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

ipcMain.handle('qr:get', async () => {
  const cfg = loadConfig();
  try {
    const buf = await sftpRead(cfg.napcatCache);
    return { ok: true, dataUrl: 'data:image/png;base64,' + buf.toString('base64') };
  } catch {
    return { ok: false, error: '没有找到二维码文件（通常说明已登录）' };
  }
});

ipcMain.handle('qr:regenerate', async () => {
  const cfg = loadConfig();
  try {
    await exec('echo qr > /root/.qqb-napcat-mode && rm -f ' + cfg.napcatCache + ' && systemctl restart qqb-napcat', 60000);
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const buf = await sftpRead(cfg.napcatCache);
        if (buf && buf.length > 100) {
          return { ok: true, dataUrl: 'data:image/png;base64,' + buf.toString('base64') };
        }
      } catch {}
    }
    return { ok: false, error: '等待二维码超时，请看日志' };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

ipcMain.handle('login:quickmode', async () => {
  try {
    await exec('echo quick > /root/.qqb-napcat-mode');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

// ---------- model config ----------
function defaultModelCfg() {
  return {
    models: [],
    roles: {
      chat: { name: '主聊天', models: [], daily_budget: 2.0 },
      background: { name: '后台（记忆/生活）', models: [], daily_budget: 0.5 },
      deep: { name: '重要时刻', models: [], daily_budget: 0.3 },
      explore: { name: '探索/浏览', models: [], daily_budget: 0.2 },
    },
    global: { daily_budget: 3.0, alert_ratio: 0.8 },
  };
}

ipcMain.handle('model:getConfig', async () => {
  try {
    const r = await exec('cat /opt/qqb/data/model_config.json 2>/dev/null || echo {}', 15000);
    const cfg = JSON.parse(r.out.trim() || '{}');
    return { ok: true, cfg };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e), cfg: defaultModelCfg() };
  }
});

ipcMain.handle('model:saveConfig', async (_e, cfg) => {
  try {
    await sftpWrite('/opt/qqb/data/model_config.json', JSON.stringify(cfg, null, 2));
    const r1 = await exec('python3 /opt/qqb/gateway/apply_models.py', 30000);
    if (r1.code !== 0) return { ok: false, error: stripAnsi(r1.out + r1.err) };
    await exec('systemctl restart qqb-gateway; sleep 2; systemctl restart qqb-astrbot; sleep 6; systemctl is-active qqb-gateway qqb-astrbot', 120000);
    const r2 = await exec('tail -n 30 /root/astrbot.log', 15000);
    return { ok: true, text: stripAnsi(r1.out + '\n--- AstrBot ---\n' + r2.out) };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

ipcMain.handle('model:test', async (_e, m) => {
  try {
    await sftpWrite('/tmp/qqb-test.json', JSON.stringify(m));
    const r = await exec(
      'curl -s --max-time 120 -X POST http://127.0.0.1:6198/test -H "Content-Type: application/json" --data-binary @/tmp/qqb-test.json',
      140000
    );
    return { ok: true, result: JSON.parse(r.out) };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

ipcMain.handle('model:fetchList', async (_e, m) => {
  try {
    await sftpWrite('/tmp/qqb-fetch.json', JSON.stringify(m));
    const r = await exec(
      'curl -s --max-time 30 -X POST http://127.0.0.1:6198/fetch_models -H "Content-Type: application/json" --data-binary @/tmp/qqb-fetch.json',
      45000
    );
    return { ok: true, result: JSON.parse(r.out) };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

ipcMain.handle('model:balance', async () => {
  try {
    const r = await exec('curl -s --max-time 40 http://127.0.0.1:6198/balance', 55000);
    return { ok: true, data: JSON.parse(r.out) };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

// ---------- 陪伴面板（独立 WebUI + SSH 隧道） ----------
const COMPANION_CFG = '/opt/qqb/AstrBot-master/data/config/astrbot_plugin_private_companion_config.json';
const PANEL_LOCAL_PORT = 16190;
let panelProc = null;

ipcMain.handle('panel:info', async () => {
  try {
    const r = await exec(`cat ${COMPANION_CFG}`, 15000);
    const cfg2 = JSON.parse(String(r.out || '').replace(/^\uFEFF/, ''));
    const b = cfg2.basic_config || {};
    return { ok: true, token: b.standalone_webui_access_token || '', port: b.standalone_webui_port || 6190, botName: b.bot_name || '' };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

function waitPort(port, timeoutMs) {
  const start = Date.now();
  return new Promise((resolve) => {
    const tryOnce = () => {
      const s = net.connect(port, '127.0.0.1');
      s.once('connect', () => { s.destroy(); resolve(true); });
      s.once('error', () => {
        s.destroy();
        if (Date.now() - start > timeoutMs) return resolve(false);
        setTimeout(tryOnce, 400);
      });
    };
    tryOnce();
  });
}

ipcMain.handle('panel:open', async () => {
  try {
    if (!panelProc || panelProc.exitCode !== null) {
      const cfg2 = loadConfig();
      panelProc = spawn('ssh', [
        '-i', cfg2.keyPath,
        '-N',
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'ExitOnForwardFailure=yes',
        '-o', 'ServerAliveInterval=30',
        '-L', `${PANEL_LOCAL_PORT}:127.0.0.1:6190`,
        `${cfg2.user}@${cfg2.host}`,
      ], { windowsHide: true, stdio: 'ignore' });
      panelProc.on('exit', () => { panelProc = null; });
    }
    const ok = await waitPort(PANEL_LOCAL_PORT, 8000);
    if (!ok) return { ok: false, error: 'SSH 隧道没起来（检查密钥/网络）' };
    shell.openExternal(`http://127.0.0.1:${PANEL_LOCAL_PORT}/`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

ipcMain.handle('panel:copy', async (_e, text) => {
  clipboard.writeText(String(text || ''));
  return { ok: true };
});

// ---------- backup ----------
ipcMain.handle('backup:run', async () => {
  try {
    const r = await exec('/opt/qqb/scripts/backup.sh', 300000);
    const remote = stripAnsi(r.out).trim().split('\n').filter(Boolean).pop();
    if (!remote || !remote.endsWith('.tar.gz')) return { ok: false, error: '备份脚本没有返回文件路径' };
    const cfg = loadConfig();
    const name = path.basename(remote);
    const local = path.join(cfg.backupDir, name);
    await sftpDownload(remote, local);
    const st = fs.statSync(local);
    return { ok: true, local, sizeMB: (st.size / 1024 / 1024).toFixed(1) };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

ipcMain.handle('backup:list', async () => {
  const cfg = loadConfig();
  try {
    const dir = cfg.backupDir;
    if (!fs.existsSync(dir)) return { ok: true, dir, files: [] };
    const files = fs.readdirSync(dir)
      .filter((f) => f.endsWith('.tar.gz'))
      .map((f) => {
        const st = fs.statSync(path.join(dir, f));
        return { name: f, sizeMB: (st.size / 1024 / 1024).toFixed(1), mtime: st.mtime.toISOString() };
      })
      .sort((a, b) => (a.mtime < b.mtime ? 1 : -1));
    return { ok: true, dir, files };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

ipcMain.handle('shell:openDir', async (_e, p) => { shell.openPath(p); return { ok: true }; });
ipcMain.handle('shell:openPath', async (_e, p) => { shell.showItemInFolder(p); return { ok: true }; });
ipcMain.handle('shell:openUrl', async (_e, u) => { shell.openExternal(u); return { ok: true }; });
