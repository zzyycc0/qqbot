const A = window.api;
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const state = { cfg: null, status: null, gateway: null, usage: null, qrLoaded: false, logSource: 'napcat', tab: 'overview' };

function toast(msg, kind = '') {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast show ' + kind;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.className = 'toast'; }, 3200);
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function num(n, d = 0) { const x = Number(n); return Number.isFinite(x) ? x.toFixed(d) : '—'; }
function pct(used, total) { if (!total) return 0; return Math.max(0, Math.min(100, Math.round((used / total) * 100))); }
function badge(ok, text) { return `<span class="badge ${ok ? 'ok' : 'bad'}">${esc(text)}</span>`; }
function setConn(ok, text) {
  const dot = $('#conn-dot');
  if (dot) dot.className = 'dot ' + (ok ? 'ok' : 'bad');
  if ($('#conn-text')) $('#conn-text').textContent = text;
}

const TITLES = {
  overview: ['总览', '服务器、服务、费用一眼看完'],
  qq: ['QQ 登录', '扫码 / 快速登录 / 登录状态'],
  services: ['服务', '启动、停止、重启、看状态'],
  model: ['费用', '今日花费、余额；模型配置去陪伴面板'],
  backup: ['备份', '打包、下载、换机恢复'],
  logs: ['日志', 'NapCat / AstrBot / 网关 / 系统'],
  settings: ['设置', '连接、令牌、关于'],
};
function switchTab(tab) {
  state.tab = tab;
  $$('nav button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  $$('.tab').forEach((s) => s.classList.toggle('active', s.id === 'tab-' + tab));
  $('#page-title').textContent = TITLES[tab][0];
  $('#server-line').textContent = tab === 'overview'
    ? `${state.cfg?.user || 'root'}@${state.cfg?.host || '—'}:${state.cfg?.port || 22}`
    : TITLES[tab][1];
  if (tab === 'qq' && !state.qrLoaded) loadQr();
  if (tab === 'model') loadCostPage();
  if (tab === 'backup') loadBackups();
  if (tab === 'logs') loadLogs();
  if (tab === 'settings') loadSettingsForm();
  if (tab === 'overview') refreshOverview();
}
$$('nav button').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));

async function refreshStatus() {
  const r = await A.getStatus();
  if (r && r.ok) { state.status = r; setConn(true, state.cfg?.host || '已连接'); }
  else { state.status = null; setConn(false, '连不上服务器'); }
  return state.status;
}
async function refreshGateway() {
  const r = await A.gatewayStatus();
  state.gateway = r && r.ok ? r.status : null;
}
async function refreshUsage() {
  const r = await A.gatewayUsage();
  state.usage = r && r.ok ? r.usage : null;
}
async function refreshOverview() {
  await refreshStatus();
  await refreshGateway();
  await refreshUsage();
  renderOverview();
}
function renderOverview() {
  const s = state.status;
  const cfg = state.cfg || {};
  $('#ov-host').textContent = s ? (s.publicIp || cfg.host || '—') : '—';
  $('#ov-uptime').textContent = s ? `已运行 ${s.uptime || '—'} · 负载 ${s.load1}/${s.load5}/${s.load15}` : '—';
  $('#ov-mem').textContent = s ? `${s.memUsed} / ${s.memTotal} MB` : '—';
  const memPct = s ? pct(s.memUsed, s.memTotal) : 0;
  $('#ov-mem-bar').style.width = memPct + '%';
  $('#ov-mem-bar').className = memPct > 88 ? 'bad' : (memPct > 70 ? 'warn' : '');
  $('#ov-disk').textContent = s ? `${s.diskUsed} / ${s.diskTotal}（${s.diskPct}）` : '—';
  const diskPct = s && s.diskPct ? parseInt(s.diskPct, 10) : 0;
  $('#ov-disk-bar').style.width = diskPct + '%';
  $('#ov-disk-bar').className = diskPct > 88 ? 'bad' : '';
  $('#ov-qq').textContent = s ? (s.napcatActive && s.qqProcs > 0 ? '在线' : '未登录 / 停止') : '—';
  $('#ov-adapter').textContent = s && s.adapterLine ? '通道已连接' : '通道未连接';
  $('#ov-adapter').className = 'card-sub ' + (s && s.adapterLine ? 'ok' : 'bad');
  $('#ov-backup-timer').textContent = s ? (s.backupTimer === 'active' ? '每天 04:00' : '未启用') : '—';
  $('#ov-ip').textContent = s ? (s.publicIp || '—') : '—';
  $('#ov-ports').textContent = s ? (s.ports || '—') : '—';
  const services = [
    ['NapCat', 'napcat', s?.napcatActive, s?.napcatEnabled],
    ['AstrBot', 'astrbot', s?.astrbotActive, s?.astrbotEnabled],
    ['模型网关', 'gateway', s?.gatewayActive, s?.gatewayEnabled],
  ];
  $('#ov-services').innerHTML = services.map(([name, key, active, enabled]) => `
    <div class="svc-row">
      <span class="dot ${active ? 'ok' : 'bad'}"></span>
      <div class="svc-name"><b>${name}</b><span>${active ? '运行中' : '已停止'}${enabled ? '' : ' · 未自启'}</span></div>
      <button class="btn tiny" data-svc="${key}" data-act="restart">重启</button>
      <button class="btn tiny ${active ? 'danger' : 'primary'}" data-svc="${key}" data-act="${active ? 'stop' : 'start'}">${active ? '停止' : '启动'}</button>
    </div>`).join('');
  $$('#ov-services [data-svc]').forEach((b) => b.addEventListener('click', () => doSvc(b.dataset.svc, b.dataset.act)));
  renderCost('#ov-cost');
}
function renderCost(sel) {
  const el = $(sel);
  if (!el) return;
  const u = state.usage;
  if (!u) { el.innerHTML = '<div class="muted">读不到用量</div>'; return; }
  const t = u.total || {};
  const items = (u.items || []).slice(0, 4);
  const head = `<div class="cost-head"><span>今日合计 · ${t.calls || 0} 次调用 · ${t.tokens || 0} tokens</span><b>¥${num(t.cost, 2)}</b></div>`;
  const rows = items.map((m) => `
    <div class="cost-row">
      <div class="cost-name">${esc(m.name)}<span>${m.calls} 次 · ${m.tokens_total} tokens</span></div>
      <div class="cost-bar"><i style="width:${t.cost ? Math.min(100, (m.cost / t.cost) * 100) : 0}%"></i></div>
      <div class="cost-val">¥${num(m.cost, 3)}</div>
    </div>`).join('');
  el.innerHTML = head + rows;
}
function renderUsageTable(sel) {
  const el = $(sel);
  if (!el) return;
  const u = state.usage;
  if (!u) { el.innerHTML = '<div class="muted">读不到用量</div>'; return; }
  const items = u.items || [];
  const t = u.total || {};
  if (!items.length) { el.innerHTML = '<div class="muted">今天还没有模型调用。</div>'; return; }
  el.innerHTML = `<table class="table">
    <thead><tr><th>模型</th><th>调用</th><th>输入 tokens</th><th>输出 tokens</th><th>总 tokens</th><th>花费</th></tr></thead>
    <tbody>${items.map((m) => `<tr>
      <td><b>${esc(m.name)}</b><div class="muted small mono">${esc(m.api_model)}</div></td>
      <td>${m.calls}</td><td>${m.tokens_in}</td><td>${m.tokens_out}</td><td>${m.tokens_total}</td><td>¥${num(m.cost, 4)}</td>
    </tr>`).join('')}
    <tr><td><b>合计</b></td><td><b>${t.calls || 0}</b></td><td></td><td></td><td><b>${t.tokens || 0}</b></td><td><b>¥${num(t.cost, 4)}</b></td></tr>
    </tbody></table>`;
}
async function doSvc(unit, action) {
  const names = { napcat: 'NapCat', astrbot: 'AstrBot', gateway: '模型网关' };
  toast(`${names[unit]} ${action === 'restart' ? '重启' : action === 'stop' ? '停止' : '启动'}中…`);
  const r = await A.svc(unit, action);
  toast(r.ok ? `${names[unit]}：${r.text}` : `失败：${r.error}`, r.ok ? 'ok' : 'bad');
  await refreshOverview();
}
$$('[data-restart]').forEach((b) => b.addEventListener('click', () => doSvc(b.dataset.restart, 'restart')));
$('#ov-services-refresh').addEventListener('click', refreshOverview);
$('#ov-cost-refresh').addEventListener('click', async () => { await refreshUsage(); renderCost('#ov-cost'); toast('已刷新'); });
$('#ov-open-model').addEventListener('click', () => switchTab('model'));
$('#ov-balance').addEventListener('click', async () => { switchTab('model'); await loadBalances(); });
$('#refresh').addEventListener('click', async () => {
  if (state.tab === 'overview') { await refreshOverview(); toast('已刷新'); }
  else if (state.tab === 'services') { await refreshStatus(); renderServices(); }
  else if (state.tab === 'qq') { await refreshQqStatus(); }
  else if (state.tab === 'model') { await loadCostPage(); }
  else if (state.tab === 'backup') { await loadBackups(); }
  else if (state.tab === 'logs') { await loadLogs(); }
});

$('#diag-run').addEventListener('click', async () => {
  const box = $('#diag-list');
  box.innerHTML = '<div class="muted">检查中…</div>';
  const r = await A.runDiag();
  if (!r.ok) { box.innerHTML = `<div class="bad">诊断失败：${esc(r.error)}</div>`; return; }
  const checks = r.diag.checks || [];
  box.innerHTML = checks.map((c) => `
    <div class="diag-row"><span class="dot ${c.ok ? 'ok' : 'bad'}"></span><div><b>${esc(c.name)}</b><span>${esc(c.detail)}</span></div></div>`).join('');
  toast(r.diag.ok ? '诊断通过' : '有项目异常', r.diag.ok ? 'ok' : 'bad');
});

// ---------------- QQ ----------------
async function loadQr() {
  $('#qr-status').textContent = '读取中…';
  const r = await A.getQr();
  if (r.ok) {
    $('#qr-img').src = r.dataUrl;
    $('#qr-img').style.display = 'block';
    $('#qr-empty').style.display = 'none';
    $('#qr-status').textContent = '二维码已加载，2–3 分钟内有效';
    state.qrLoaded = true;
  } else {
    $('#qr-img').style.display = 'none';
    $('#qr-empty').style.display = 'block';
    $('#qr-empty').textContent = r.error || '没有二维码';
    $('#qr-status').textContent = '';
  }
  await refreshQqStatus();
}
async function refreshQqStatus() {
  await refreshStatus();
  const s = state.status;
  if (!s) return;
  $('#qq-svc').textContent = s.napcatActive ? '运行中' : '已停止';
  $('#qq-proc').textContent = s.qqProcs > 0 ? '在' : '不在';
  $('#qq-adapter').textContent = s.adapterLine ? '已连接' : '未连接';
  const mode = await A.getConfig();
  $('#qq-mode').textContent = mode.uin ? `机器人 ${mode.uin}` : '—';
  $('#qq-last').textContent = s.napcatLine || '—';
}
$('#qr-refresh').addEventListener('click', async () => {
  $('#qr-status').textContent = '正在重启 NapCat 生成二维码…';
  $('#qr-img').style.display = 'none';
  $('#qr-empty').style.display = 'block';
  $('#qr-empty').textContent = '生成中，约 30 秒…';
  const r = await A.regenerateQr();
  if (r.ok) {
    $('#qr-img').src = r.dataUrl;
    $('#qr-img').style.display = 'block';
    $('#qr-empty').style.display = 'none';
    $('#qr-status').textContent = '二维码已生成';
    state.qrLoaded = true;
  } else {
    $('#qr-empty').textContent = r.error || '生成失败';
    toast(r.error || '生成失败', 'bad');
  }
  await refreshQqStatus();
});
$('#qr-quick').addEventListener('click', async () => {
  const r = await A.quickMode();
  toast(r.ok ? '已切快速登录模式' : r.error, r.ok ? 'ok' : 'bad');
});
$('#qq-refresh').addEventListener('click', refreshQqStatus);

// ---------------- services ----------------
function renderServices() {
  const s = state.status;
  const rows = [
    ['NapCat (QQ)', 'napcat', s?.napcatActive, s?.napcatEnabled, 'QQ 协议端，扫码/快速登录'],
    ['AstrBot', 'astrbot', s?.astrbotActive, s?.astrbotEnabled, '聊天主程序 + 陪伴插件'],
    ['模型网关', 'gateway', s?.gatewayActive, s?.gatewayEnabled, '模型路由、备用、记账、限额'],
  ];
  $('#svc-tbody').innerHTML = rows.map(([name, key, active, enabled, desc]) => `
    <tr>
      <td><b>${name}</b></td>
      <td>${badge(!!active, active ? '运行中' : '已停止')}</td>
      <td>${badge(!!enabled, enabled ? '已启用' : '未启用')}</td>
      <td class="muted">${desc}</td>
      <td class="row-actions">
        <button class="btn tiny" data-act="restart" data-unit="${key}">重启</button>
        <button class="btn tiny ${active ? 'danger' : 'primary'}" data-act="${active ? 'stop' : 'start'}" data-unit="${key}">${active ? '停止' : '启动'}</button>
      </td>
    </tr>`).join('');
  $$('#svc-tbody [data-unit]').forEach((b) => b.addEventListener('click', () => doSvc(b.dataset.unit, b.dataset.act)));
}
$('#svc-refresh').addEventListener('click', async () => { await refreshStatus(); renderServices(); });
$('#svc-restart-all').addEventListener('click', async () => {
  if (!confirm('确定按 网关 → NapCat → AstrBot 顺序全部重启？')) return;
  for (const u of ['gateway', 'napcat', 'astrbot']) await doSvc(u, 'restart');
});

// ---------------- cost/balance ----------------
async function loadCostPage() {
  await refreshUsage();
  renderUsageTable('#model-cost');
  await loadBalances();
}
async function loadBalances() {
  const box = $('#balance-list');
  box.innerHTML = '<div class="muted">读取中…</div>';
  const r = await A.getBalances();
  if (!r.ok) { box.innerHTML = `<div class="bad">读取失败：${esc(r.error)}</div>`; return; }
  const d = r.data || {};
  const rows = [];
  for (const [k, v] of Object.entries(d)) {
    if (!v || typeof v !== 'object') continue;
    if (v.balance != null) rows.push(`<div class="balance-row"><b>${esc(k)}</b><span>${esc(v.currency || '')} ${esc(v.balance)}</span></div>`);
    else if (v.error) rows.push(`<div class="balance-row"><b>${esc(k)}</b><span class="bad">${esc(v.error)}</span></div>`);
    else if (v.note) rows.push(`<div class="balance-row"><b>${esc(k)}</b><span>${esc(v.note)}</span></div>`);
  }
  box.innerHTML = rows.join('') || '<div class="muted">没有可显示的余额（中转站余额需去控制台看）</div>';
}
$('#cost-refresh').addEventListener('click', loadCostPage);
$('#balance-refresh').addEventListener('click', loadBalances);

// ---------------- backup ----------------
async function loadBackups() {
  const cfg = await A.getConfig();
  state.cfg = cfg;
  $('#backup-local-dir').textContent = '本地目录：' + (cfg.backupDir || '—');
  const [remote, local] = await Promise.all([A.listRemoteBackups(), A.listBackups()]);
  const timer = remote.ok ? remote.timer : '';
  $('#backup-timer').textContent = timer === 'active' ? '自动备份：每天 04:00' : '自动备份：未启用';
  $('#backup-timer').className = 'badge ' + (timer === 'active' ? 'ok' : 'bad');
  const rf = remote.ok ? remote.files : [];
  $('#backup-remote-tbody').innerHTML = rf.length ? rf.map((f) => `
    <tr><td class="mono small">${esc(f.name)}</td><td>${esc(f.sizeMB)} MB</td><td class="muted">${esc(f.mtime)}</td>
    <td><button class="btn tiny" data-dl="${esc(f.name)}">下载</button></td></tr>`).join('') : '<tr><td colspan="4" class="muted">服务器上还没有备份</td></tr>';
  $$('#backup-remote-tbody [data-dl]').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true; b.textContent = '下载中…';
    const r = await A.downloadRemoteBackup(b.dataset.dl);
    toast(r.ok ? `已下载：${r.local}（${r.sizeMB} MB）` : '下载失败：' + r.error, r.ok ? 'ok' : 'bad');
    b.disabled = false; b.textContent = '下载';
    if (r.ok) loadBackups();
  }));
  const lf = local.ok ? local.files : [];
  $('#backup-local-tbody').innerHTML = lf.length ? lf.map((f) => `
    <tr><td class="mono small">${esc(f.name)}</td><td>${esc(f.sizeMB)} MB</td><td class="muted">${esc(f.mtime)}</td>
    <td><button class="btn tiny" data-open="1">打开目录</button></td></tr>`).join('') : '<tr><td colspan="4" class="muted">本地还没有备份</td></tr>';
  $$('#backup-local-tbody [data-open]').forEach((b) => b.addEventListener('click', () => A.openDir(local.dir)));
}
$('#backup-run').addEventListener('click', async () => {
  toast('备份中，可能要一两分钟…');
  const r = await A.runBackup();
  toast(r.ok ? `备份完成：${r.local}（${r.sizeMB} MB）` : '备份失败：' + r.error, r.ok ? 'ok' : 'bad');
  if (r.ok) loadBackups();
});
$('#backup-refresh').addEventListener('click', loadBackups);
$('#backup-open-dir').addEventListener('click', async () => { const c = await A.getConfig(); A.openDir(c.backupDir); });

// ---------------- logs ----------------
async function loadLogs() {
  const box = $('#log-view');
  box.textContent = '加载中…';
  const r = await A.getLogs(state.logSource);
  box.textContent = r.ok ? (r.text || '(空)') : ('读取失败：' + r.error);
  box.scrollTop = box.scrollHeight;
}
$$('#log-seg button').forEach((b) => b.addEventListener('click', () => {
  state.logSource = b.dataset.src;
  $$('#log-seg button').forEach((x) => x.classList.toggle('active', x === b));
  loadLogs();
}));
$('#log-refresh').addEventListener('click', loadLogs);

// ---------------- settings ----------------
async function loadSettingsForm() {
  const cfg = await A.getConfig();
  state.cfg = cfg;
  $('#cfg-host').value = cfg.host || '';
  $('#cfg-port').value = cfg.port || 22;
  $('#cfg-user').value = cfg.user || 'root';
  $('#cfg-uin').value = cfg.uin || '';
  $('#cfg-key').value = cfg.keyPath || '';
  $('#cfg-backup').value = cfg.backupDir || '';
  $('#about-host').textContent = cfg.host || '—';
  const p = await A.panelInfo();
  $('#panel-token').textContent = p.ok ? (p.token || '（空）') : '读取失败：' + p.error;
}
$('#cfg-save').addEventListener('click', async () => {
  const cfg = {
    host: $('#cfg-host').value.trim(),
    port: Number($('#cfg-port').value) || 22,
    user: $('#cfg-user').value.trim() || 'root',
    uin: $('#cfg-uin').value.trim(),
    keyPath: $('#cfg-key').value.trim(),
    backupDir: $('#cfg-backup').value.trim(),
  };
  const r = await A.saveConfig(cfg);
  state.cfg = r;
  $('#cfg-msg').textContent = '已保存';
  setConn(false, '重新连接…');
  await refreshStatus();
  toast('设置已保存');
});
$('#cfg-test').addEventListener('click', async () => {
  const r = await A.testSsh();
  toast(r.ok ? '连接正常：' + (r.text || '') : '连接失败：' + r.error, r.ok ? 'ok' : 'bad');
});

// ---------------- panel ----------------
async function openPanel() {
  const r = await A.panelOpen();
  if (!r.ok) toast('打开面板失败：' + r.error, 'bad');
}
$('#panel-open').addEventListener('click', openPanel);
$('#quick-panel').addEventListener('click', openPanel);
$('#panel-open2').addEventListener('click', openPanel);
$('#panel-copy').addEventListener('click', async () => {
  const t = $('#panel-token').textContent || '';
  if (!t || t === '—') { toast('还没有令牌'); return; }
  await A.panelCopy(t);
  toast('令牌已复制', 'ok');
});
$('#panel-refresh-token').addEventListener('click', async () => {
  const p = await A.panelInfo();
  $('#panel-token').textContent = p.ok ? (p.token || '（空）') : '读取失败：' + p.error;
});
$('#quick-backup').addEventListener('click', () => { switchTab('backup'); loadBackups(); });
$('#quick-qq').addEventListener('click', () => switchTab('qq'));
$('#quick-logs').addEventListener('click', () => switchTab('logs'));

// ---------------- boot ----------------
(async function boot() {
  state.cfg = await A.getConfig();
  setConn(false, '连接中…');
  await refreshOverview();
  await loadSettingsForm();
  renderServices();
  const tab = new URLSearchParams(location.search).get('tab');
  if (tab && TITLES[tab]) switchTab(tab);
  setInterval(async () => { if (state.tab === 'overview') await refreshOverview(); }, 20000);
})();
