const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const A = window.api;

const ROLE_ORDER = ['chat', 'background', 'deep', 'explore'];
const ROLE_DESC = {
  chat: '所有日常对话，最重要，花得也最多',
  background: '记忆总结、生活事件、主动消息策划（慢一点没关系）',
  deep: '情绪低落、纪念日、深度话题时用，贵但更聪明',
  explore: '联网看资讯/查资料时用',
};
const MODEL_ROLES = {
  chat: '主聊天',
  background: '后台（记忆/生活）',
  deep: '重要时刻',
  explore: '探索/浏览',
};

let cfg = {};
let modelCfg = null;
let editingId = null;
let gatewayStatus = null;
let statusTimer = null;
let logTimer = null;
let loadedTabs = {};

// ---------------- tabs ----------------
$$('nav button').forEach((b) => {
  b.addEventListener('click', () => {
    $$('nav button').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    $$('.tab').forEach((t) => t.classList.remove('active'));
    $('#tab-' + b.dataset.tab).classList.add('active');
    if (b.dataset.tab === 'model' && !loadedTabs.model) { loadedTabs.model = 1; loadModelConfig(); }
    if (b.dataset.tab === 'backup' && !loadedTabs.backup) { loadedTabs.backup = 1; loadBackups(); }
    if (b.dataset.tab === 'life' && !loadedTabs.life) { loadedTabs.life = 1; loadLife(); }
    if (b.dataset.tab === 'persona' && !loadedTabs.persona) { loadedTabs.persona = 1; loadPersonaEditor(); }
    if (b.dataset.tab === 'panel' && !loadedTabs.panel) { loadedTabs.panel = 1; loadPanel(); }
  });
});

function setText(sel, text, cls) {
  const el = $(sel);
  if (!el) return;
  el.textContent = text;
  el.classList.remove('ok', 'bad', 'warn');
  if (cls) el.classList.add(cls);
}
function setBar(sel, ratio, warnAt = 0.8, badAt = 0.95) {
  const el = $(sel);
  if (!el) return;
  const r = Math.max(0, Math.min(1, ratio || 0));
  el.style.width = (r * 100).toFixed(1) + '%';
  el.classList.remove('warn', 'bad');
  if (r >= badAt) el.classList.add('bad');
  else if (r >= warnAt) el.classList.add('warn');
}

// ---------------- status ----------------
async function refreshStatus() {
  const btn = $('#status-refresh');
  if (btn) btn.disabled = true;
  try {
    const st = await A.getStatus();
    if (!st.ok) {
      $('#status-error').classList.remove('hidden');
      $('#status-error').textContent = '连接失败：' + st.error;
      return;
    }
    $('#status-error').classList.add('hidden');
    setText('#st-napcat', st.napcatActive ? '运行中' : '已停止', st.napcatActive ? 'ok' : 'bad');
    setText('#st-astrbot', st.astrbotActive ? '运行中' : '已停止', st.astrbotActive ? 'ok' : 'bad');
    const adapterOk = /适配器已连接/.test(st.adapterLine);
    setText('#st-adapter', adapterOk ? '已连接' : '未连接', adapterOk ? 'ok' : 'warn');
    setText('#st-mem', `${st.memUsed} / ${st.memTotal} MB`);
    setBar('#st-mem-bar', st.memUsed / Math.max(1, st.memTotal));
    setText('#st-swap', st.swapTotal ? `swap ${st.swapUsed} / ${st.swapTotal} MB` : '无 swap');
    setText('#st-disk', `${st.diskUsed} / ${st.diskTotal}`);
    setBar('#st-disk-bar', parseInt(st.diskPct, 10) / 100);
    setText('#st-load', `${st.load1} / ${st.load5} / ${st.load15}`, Number(st.load1) > 2 ? 'warn' : '');
    setText('#st-uptime', '已运行 ' + st.uptime.replace('up ', ''));
    $('#st-lastline').textContent = st.napcatLine ? 'NapCat 最近：' + st.napcatLine : '';
    $('#status-time').textContent = '更新于 ' + new Date().toLocaleTimeString();
    if (st.napcatActive && /网络已连接|正在快速登录|登录成功/.test(st.napcatLine)) {
      setText('#st-napcat', '运行中 · QQ 在线', 'ok');
    }
    const g = await A.gatewayStatus();
    if (g.ok) {
      gatewayStatus = g.status;
      renderBudgetCard();
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

function renderBudgetCard() {
  if (!gatewayStatus) return;
  const g = gatewayStatus.global || {};
  const spent = Number(g.spent || 0);
  const budget = Number(g.budget || 0);
  const el = $('#st-budget');
  if (el) el.textContent = budget > 0 ? `今日已用 ¥${spent.toFixed(2)} / ¥${budget.toFixed(2)}` : `今日已用 ¥${spent.toFixed(2)}（不限）`;
  setBar('#st-budget-bar', budget > 0 ? spent / budget : 0);
  const parts = [];
  const roles = gatewayStatus.roles || {};
  ROLE_ORDER.forEach((r) => {
    if (roles[r]) parts.push(`${roles[r].name} ¥${Number(roles[r].spent || 0).toFixed(2)}`);
  });
  const sub = $('#st-budget-sub');
  if (sub) sub.textContent = parts.join(' · ') || '还没有调用记录';
  const extra = $('#st-budget-extra');
  if (extra) extra.textContent = '今日调用 ' + (gatewayStatus.calls_today || 0) + ' 次';
}

function setAutoStatus(on) {
  if (statusTimer) { clearInterval(statusTimer); statusTimer = null; }
  if (on) statusTimer = setInterval(refreshStatus, 5000);
}
$('#status-refresh').addEventListener('click', refreshStatus);
$('#status-auto').addEventListener('change', (e) => setAutoStatus(e.target.checked));

// ---------------- login ----------------
async function loadQr(force) {
  const msg = $('#qr-msg');
  msg.textContent = '';
  const res = force ? await A.regenerateQr() : await A.getQr();
  if (res.ok) {
    $('#qr-img').src = res.dataUrl;
    $('#qr-img').style.display = 'block';
    $('#qr-placeholder').style.display = 'none';
    if (force) msg.textContent = '新二维码已生成，约 2–3 分钟内有效，请用手机 QQ 扫码并在手机上点“允许登录”。';
  } else {
    $('#qr-img').style.display = 'none';
    $('#qr-placeholder').style.display = 'block';
    msg.textContent = res.error || '没有二维码';
  }
}
$('#qr-get').addEventListener('click', () => loadQr(false));
$('#qr-regen').addEventListener('click', async () => {
  const btn = $('#qr-regen');
  btn.disabled = true; btn.textContent = '生成中…（约 20–60 秒）';
  try { await loadQr(true); } finally { btn.disabled = false; btn.textContent = '重新生成二维码'; }
});
$('#qr-quick').addEventListener('click', async () => {
  const r = await A.quickMode();
  $('#qr-msg').textContent = r.ok ? '已切换：下次重启会使用快速登录，不再需要扫码。' : ('失败：' + r.error);
});

// ---------------- control ----------------
$$('[data-svc]').forEach((b) => {
  b.addEventListener('click', async () => {
    const svc = b.dataset.svc, act = b.dataset.act;
    const label = { start: '启动', stop: '停止', restart: '重启' }[act];
    const names = { napcat: 'NapCat', astrbot: 'AstrBot', gateway: '模型网关' };
    if (!confirm(`确定要${label} ${names[svc]} 吗？`)) return;
    setText('#ctrl-' + svc, '执行中…');
    const r = await A.svc(svc, act);
    setText('#ctrl-' + svc, r.ok ? `已${label}（当前：${r.text}）` : '失败：' + r.error, r.ok ? 'ok' : 'bad');
    refreshStatus();
  });
});

// ---------------- logs ----------------
async function refreshLogs() {
  const src = $('#log-source').value;
  const r = await A.getLogs(src);
  $('#log-box').textContent = r.ok ? r.text : '读取失败：' + r.error;
  $('#log-box').scrollTop = $('#log-box').scrollHeight;
}
function setAutoLogs(on) {
  if (logTimer) { clearInterval(logTimer); logTimer = null; }
  if (on) logTimer = setInterval(refreshLogs, 3000);
}
$('#log-refresh').addEventListener('click', refreshLogs);
$('#log-source').addEventListener('change', refreshLogs);
$('#log-auto').addEventListener('change', (e) => setAutoLogs(e.target.checked));

// ---------------- life ----------------
function moodText(m) {
  m = Number(m) || 0;
  if (m >= 30) return '心情不错';
  if (m >= 10) return '还算平静';
  if (m >= -10) return '有点平淡';
  if (m >= -30) return '有点闷';
  return '心情不太好';
}

async function loadLife() {
  const head = $('#life-head');
  head.textContent = '读取中…';
  const r = await A.getLife();
  if (!r.ok) { head.textContent = '读取失败：' + r.error; return; }
  const d = r.data || {};
  if (!d.ok) { head.textContent = '读取失败：' + (d.error || ''); return; }
  const p = d.persona || {};
  const s = d.state || {};
  head.textContent = `${p.name || '她'}，${p.age || ''}岁，${p.identity || ''}。${p.personality || ''}`;
  setText('#life-mood', moodText(s.mood));
  setText('#life-energy', `${s.energy ?? '-'} / 100`);
  setText('#life-intimacy', `${s.intimacy ?? '-'} / 100`);
  setBar('#life-mood-bar', ((Number(s.mood) || 0) + 100) / 200);
  setBar('#life-energy-bar', (Number(s.energy) || 0) / 100);
  setBar('#life-intimacy-bar', (Number(s.intimacy) || 0) / 100);
  $('#life-activity').textContent = s.activity || '-';
  $('#life-stage').textContent = '关系阶段：' + (s.stage || '初识') + (s.birth_at ? ' · 出生 ' + s.birth_at : '');
  const events = (d.events || []).map((e) => `<div class="rowline"><span class="ts">${(e.ts || '').slice(5, 16)}</span>${escapeHtml(e.content)}</div>`).join('');
  $('#life-events').innerHTML = events || '<div class="muted">还没有生活记录</div>';
  const msgs = (d.messages || []).slice().reverse().map((m) => `<div class="rowline"><span class="ts">${(m.ts || '').slice(5, 16)}</span>${m.role === 'user' ? '你：' : '她：'}${escapeHtml(m.content)}</div>`).join('');
  $('#life-msgs').innerHTML = msgs || '<div class="muted">还没有记录</div>';
  const mems = (d.memories || []).map((m) => `<div class="rowline"><span class="ts">${(m.ts || '').slice(5, 16)}</span>${escapeHtml(m.content)}</div>`).join('');
  $('#life-memories').innerHTML = mems || '<div class="muted">还没有记住什么</div>';
  $('#life-updated').textContent = '更新于 ' + new Date().toLocaleTimeString();
}
$('#life-refresh').addEventListener('click', loadLife);

// ---------------- 陪伴面板 ----------------
async function loadPanel() {
  const box = $('#panel-token');
  if (!box) return;
  box.textContent = '读取中…';
  const r = await A.panelInfo();
  box.textContent = r.ok ? (r.token || '（空）') : ('读取失败：' + r.error);
}
$('#panel-refresh').addEventListener('click', loadPanel);
$('#panel-open').addEventListener('click', async () => {
  const r = await A.panelOpen();
  if (!r.ok) alert('打开面板失败：' + r.error);
});
$('#panel-copy').addEventListener('click', async () => {
  const t = $('#panel-token').textContent || '';
  if (t && t !== '读取中…') { await A.panelCopy(t); alert('令牌已复制'); }
});

// ---------------- 人设 ----------------
function splitList(s) {
  return String(s || '').split(/[,，、\n]/).map((x) => x.trim()).filter(Boolean);
}
function splitLines(s) {
  return String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);
}

async function loadPersonaEditor() {
  const r = await A.getPersona();
  if (r.ok) {
    const p = r.data || {};
    $('#p-name').value = p.name || '';
    $('#p-age').value = p.age || '';
    $('#p-identity').value = p.identity || '';
    $('#p-background').value = p.background || '';
    $('#p-personality').value = p.personality || '';
    $('#p-speech').value = p.speech_style || '';
    $('#p-likes').value = (p.likes || []).join('，');
    $('#p-dislikes').value = (p.dislikes || []).join('，');
    $('#p-opinions').value = (p.opinions || []).join('\n');
    $('#p-boundaries').value = (p.boundaries || []).join('\n');
    $('#p-self').value = p.self_awareness || '';
    $('#persona-state').textContent = '已读取';
  } else {
    $('#persona-state').textContent = '读取失败：' + r.error;
  }
  const s = await A.getLifeSettings();
  const v = { proactive_enabled: true, proactive_max_per_day: 2, proactive_day_start: 10, proactive_day_end: 22, proactive_min_interval_hours: 4, ...(s.data || {}) };
  $('#s-proactive-enable').checked = !!v.proactive_enabled;
  $('#s-proactive-max').value = v.proactive_max_per_day;
  $('#s-proactive-start').value = v.proactive_day_start;
  $('#s-proactive-end').value = v.proactive_day_end;
  $('#s-proactive-interval').value = v.proactive_min_interval_hours;
}

$('#persona-save').addEventListener('click', async () => {
  const p = {
    name: $('#p-name').value.trim(),
    age: Number($('#p-age').value) || 22,
    identity: $('#p-identity').value.trim(),
    background: $('#p-background').value.trim(),
    personality: $('#p-personality').value.trim(),
    speech_style: $('#p-speech').value.trim(),
    likes: splitList($('#p-likes').value),
    dislikes: splitList($('#p-dislikes').value),
    opinions: splitLines($('#p-opinions').value),
    boundaries: splitLines($('#p-boundaries').value),
    self_awareness: $('#p-self').value.trim(),
  };
  if (!p.name) { $('#persona-msg').textContent = '名字不能为空'; return; }
  const r = await A.savePersona(p);
  $('#persona-msg').textContent = r.ok ? '✅ 人设已保存，下一条消息就会用新人设（无需重启）' : '❌ 保存失败：' + r.error;
});

$('#set-save').addEventListener('click', async () => {
  const v = {
    proactive_enabled: $('#s-proactive-enable').checked,
    proactive_max_per_day: Number($('#s-proactive-max').value) || 2,
    proactive_day_start: Number($('#s-proactive-start').value) || 10,
    proactive_day_end: Number($('#s-proactive-end').value) || 22,
    proactive_min_interval_hours: Number($('#s-proactive-interval').value) || 4,
  };
  const r = await A.saveLifeSettings(v);
  $('#set-msg').textContent = r.ok ? '✅ 主动消息设置已保存（下一次 tick 生效）' : '❌ 保存失败：' + r.error;
});

// ---------------- model config ----------------
function defaultModelCfg() {
  const roles = {};
  ROLE_ORDER.forEach((r) => {
    roles[r] = {
      name: MODEL_ROLES[r],
      models: [],
      daily_budget: r === 'chat' ? 2 : r === 'background' ? 0.5 : r === 'deep' ? 0.3 : 0.2,
    };
  });
  return { models: [], roles, global: { daily_budget: 3, alert_ratio: 0.8 } };
}
function normalizeModelCfg(c) {
  const d = defaultModelCfg();
  if (!c || typeof c !== 'object') return d;
  const out = { ...d, models: Array.isArray(c.models) ? c.models : [], global: { ...d.global, ...(c.global || {}) } };
  out.roles = { ...d.roles };
  ROLE_ORDER.forEach((r) => {
    const src = (c.roles || {})[r] || {};
    out.roles[r] = {
      name: MODEL_ROLES[r],
      models: Array.isArray(src.models) ? src.models.filter((x) => typeof x === 'string') : [],
      daily_budget: src.daily_budget === undefined ? d.roles[r].daily_budget : Number(src.daily_budget),
    };
  });
  return out;
}
function modelName(id) {
  const m = (modelCfg.models || []).find((x) => x.id === id);
  return m ? (m.name || m.model || id) : id;
}
function markModelDirty() {
  setText('#model-save-state', '有未保存的修改', 'warn');
}

async function loadModelConfig() {
  const r = await A.getModelConfig();
  modelCfg = normalizeModelCfg(r.cfg);
  renderModelTable();
  renderRoles();
  $('#g-budget').value = modelCfg.global.daily_budget ?? 3;
  $('#g-alert').value = modelCfg.global.alert_ratio ?? 0.8;
  await refreshUsage();
  loadBalances();
  if (r.ok) setText('#model-save-state', '已从服务器读取配置', 'ok');
  else setText('#model-save-state', '读取失败：' + r.error, 'bad');
}

function renderModelTable() {
  const tbody = $('#model-tbl tbody');
  if (!modelCfg || !modelCfg.models.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="muted">还没有模型，用下面的表单添加第一个</td></tr>';
    return;
  }
  tbody.innerHTML = modelCfg.models.map((m) => `
    <tr data-id="${m.id}">
      <td>${escapeHtml(m.name || m.model || m.id)}</td>
      <td>${escapeHtml(m.model || '')}</td>
      <td class="muted">${escapeHtml(m.base_url || '')}</td>
      <td>${m.price_in ?? '-'} / ${m.price_out ?? '-'}</td>
      <td>${m.enabled === false ? '<span class="tag-badge badge-off">停用</span>' : '<span class="tag-badge badge-ok">启用</span>'}</td>
      <td>
        <button class="btn" data-act="edit">编辑</button>
        <button class="btn" data-act="test">测试</button>
        <button class="btn" data-act="toggle">${m.enabled === false ? '启用' : '停用'}</button>
        <button class="btn" data-act="del">删除</button>
      </td>
    </tr>`).join('');
}

$('#model-tbl').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const tr = btn.closest('tr');
  const id = tr.dataset.id;
  const m = modelCfg.models.find((x) => x.id === id);
  if (!m) return;
  const act = btn.dataset.act;
  if (act === 'edit') fillEditor(m);
  if (act === 'test') {
    const out = $('#model-row-result');
    out.textContent = `测试「${m.name || m.model}」中…（最长约 2 分钟）`;
    const r = await A.testModel(m);
    if (!r.ok) { out.textContent = '❌ ' + r.error; return; }
    const x = r.result;
    out.textContent = x.ok ? `✅「${m.name || m.model}」正常（${x.latency_ms}ms）：${x.content}` : `❌「${m.name || m.model}」失败（${x.latency_ms}ms）：${x.error}`;
  }
  if (act === 'toggle') { m.enabled = m.enabled === false; renderModelTable(); markModelDirty(); }
  if (act === 'del') {
    if (!confirm(`删除模型「${m.name || m.model}」？`)) return;
    modelCfg.models = modelCfg.models.filter((x) => x.id !== id);
    ROLE_ORDER.forEach((r) => { modelCfg.roles[r].models = modelCfg.roles[r].models.filter((x) => x !== id); });
    renderModelTable(); renderRoles(); markModelDirty();
  }
});

function fillEditor(m) {
  editingId = m.id;
  $('#editor-title').textContent = '编辑模型：' + (m.name || m.model);
  $('#ed-name').value = m.name || '';
  $('#ed-model').value = m.model || '';
  $('#ed-base').value = m.base_url || '';
  $('#ed-key').value = m.api_key || '';
  $('#ed-pin').value = m.price_in ?? '';
  $('#ed-pout').value = m.price_out ?? '';
  $('#ed-result').textContent = '';
}
function clearEditor() {
  editingId = null;
  $('#editor-title').textContent = '添加模型';
  ['#ed-name', '#ed-model', '#ed-base', '#ed-key', '#ed-pin', '#ed-pout'].forEach((s) => { $(s).value = ''; });
  $('#ed-result').textContent = '';
  $('#ed-fetched').classList.add('hidden');
  $('#ed-fetched').innerHTML = '';
}
function editorModel() {
  return {
    id: editingId || ('m_' + Date.now()),
    name: $('#ed-name').value.trim(),
    model: $('#ed-model').value.trim(),
    base_url: $('#ed-base').value.trim(),
    api_key: $('#ed-key').value.trim(),
    price_in: Number($('#ed-pin').value) || 0,
    price_out: Number($('#ed-pout').value) || 0,
    enabled: true,
  };
}
$('#ed-save').addEventListener('click', () => {
  const m = editorModel();
  if (!m.name || !m.model || !m.base_url) { $('#ed-result').textContent = '名称、模型 ID、接口地址是必填的。'; return; }
  if (editingId) {
    const i = modelCfg.models.findIndex((x) => x.id === editingId);
    const old = modelCfg.models[i];
    modelCfg.models[i] = { ...old, ...m, id: old.id, enabled: old.enabled !== false };
  } else {
    modelCfg.models.push(m);
  }
  clearEditor();
  renderModelTable(); renderRoles();
  markModelDirty();
  $('#ed-result').textContent = '已加入模型列表（还没生效，最后点“保存全部并生效”）';
});
$('#ed-clear').addEventListener('click', clearEditor);
$('#ed-test').addEventListener('click', async () => {
  const m = editorModel();
  if (!m.model || !m.base_url || !m.api_key) { $('#ed-result').textContent = '测试需要模型 ID、接口地址、Key。'; return; }
  $('#ed-result').textContent = '测试中…（最长约 2 分钟，慢模型会久一点）';
  const r = await A.testModel(m);
  if (!r.ok) { $('#ed-result').textContent = '❌ ' + r.error; return; }
  const x = r.result;
  $('#ed-result').textContent = x.ok ? `✅ 连接正常（${x.latency_ms}ms）返回：${x.content}` : `❌ 失败（${x.latency_ms}ms）：${x.error}`;
});
$('#ed-fetch').addEventListener('click', async () => {
  const m = editorModel();
  if (!m.base_url || !m.api_key) { $('#ed-result').textContent = '拉取列表需要接口地址和 Key。'; return; }
  $('#ed-result').textContent = '拉取模型列表中…';
  const r = await A.fetchModels({ base_url: m.base_url, api_key: m.api_key });
  if (!r.ok) { $('#ed-result').textContent = '❌ ' + r.error; return; }
  const x = r.result;
  if (!x.ok) { $('#ed-result').textContent = '❌ ' + (x.error || '失败'); return; }
  const sel = $('#ed-fetched');
  sel.innerHTML = '<option value="">从列表中选择模型…</option>' + x.models.map((id) => `<option value="${id}">${id}</option>`).join('');
  sel.classList.remove('hidden');
  $('#ed-result').textContent = `找到 ${x.models.length} 个模型，选一个会自动填入“模型 ID”。`;
});
$('#ed-fetched').addEventListener('change', (e) => { if (e.target.value) $('#ed-model').value = e.target.value; });

function renderRoles() {
  const wrap = $('#role-list');
  if (!modelCfg) return;
  wrap.innerHTML = ROLE_ORDER.map((r) => {
    const role = modelCfg.roles[r];
    const tags = (role.models || []).map((id, i) => `
      <span class="tag"><span class="idx">${i + 1}.</span>${escapeHtml(modelName(id))}
        <button data-role="${r}" data-move="up" data-idx="${i}" title="上移（更优先）">↑</button>
        <button data-role="${r}" data-move="down" data-idx="${i}" title="下移">↓</button>
        <button data-role="${r}" data-remove="${id}" title="移除">×</button>
      </span>`).join('') || '<span class="route-empty">还没有分配模型，这个职责暂时用不了</span>';
    const options = (modelCfg.models || []).filter((m) => m.enabled !== false)
      .map((m) => `<option value="${m.id}">${escapeHtml(m.name || m.model)}</option>`).join('');
    return `
      <div class="group role-card" data-role="${r}">
        <div class="role-head">
          <div>
            <h3>${MODEL_ROLES[r]}${r === 'chat' ? '（默认对话）' : ''}</h3>
            <div class="muted">${ROLE_DESC[r]}</div>
          </div>
          <div class="budget-in">日预算 <input type="number" step="0.1" data-role-budget="${r}" value="${role.daily_budget ?? 0}" /> 元</div>
        </div>
        <div class="route-list">${tags}</div>
        <div class="row">
          <select data-role-select="${r}"><option value="">选择模型加入…</option>${options}</select>
          <button class="btn" data-role-add="${r}">加入</button>
        </div>
        <div class="sub" data-role-usage="${r}"></div>
      </div>`;
  }).join('');
}

$('#role-list').addEventListener('click', (e) => {
  const rm = e.target.closest('button[data-remove]');
  if (rm) {
    const r = rm.dataset.role;
    modelCfg.roles[r].models = modelCfg.roles[r].models.filter((x) => x !== rm.dataset.remove);
    renderRoles(); markModelDirty(); return;
  }
  const mv = e.target.closest('button[data-move]');
  if (mv) {
    const r = mv.dataset.role;
    const idx = Number(mv.dataset.idx);
    const arr = modelCfg.roles[r].models;
    const j = mv.dataset.move === 'up' ? idx - 1 : idx + 1;
    if (j >= 0 && j < arr.length) {
      const tmp = arr[idx]; arr[idx] = arr[j]; arr[j] = tmp;
      renderRoles(); markModelDirty();
    }
    return;
  }
  const add = e.target.closest('button[data-role-add]');
  if (add) {
    const r = add.dataset.roleAdd;
    const sel = document.querySelector(`select[data-role-select="${r}"]`);
    const id = sel && sel.value;
    const hint = document.querySelector(`[data-role-usage="${r}"]`);
    if (!id) { if (hint) hint.textContent = '先在左边的下拉框里选一个模型，再点加入'; return; }
    if (modelCfg.roles[r].models.includes(id)) { if (hint) hint.textContent = '这个模型已经在列表里了'; return; }
    modelCfg.roles[r].models.push(id);
    renderRoles(); markModelDirty(); return;
  }
});
$('#role-list').addEventListener('change', (e) => {
  const inp = e.target.closest('input[data-role-budget]');
  if (inp) {
    const r = inp.dataset.roleBudget;
    modelCfg.roles[r].daily_budget = Number(inp.value) || 0;
    markModelDirty();
  }
});

async function refreshUsage() {
  const g = await A.gatewayStatus();
  if (!g.ok) { $('#budget-usage').innerHTML = '<div class="muted">读取用量失败：' + escapeHtml(g.error) + '</div>'; return; }
  gatewayStatus = g.status;
  const roles = gatewayStatus.roles || {};
  $('#budget-usage').innerHTML = ROLE_ORDER.map((r) => {
    const x = roles[r] || { spent: 0, budget: 0 };
    const spent = Number(x.spent || 0), budget = Number(x.budget || 0);
    const pct = budget > 0 ? Math.min(1, spent / budget) : 0;
    const info = budget > 0 ? `¥${spent.toFixed(2)} / ¥${budget.toFixed(2)}` : `¥${spent.toFixed(2)} / 不限`;
    return `<div class="usage-row"><span>${MODEL_ROLES[r]}</span><div class="bar"><i style="width:${(pct * 100).toFixed(1)}%"></i></div><span class="num">${info}</span></div>`;
  }).join('') + `<div class="muted">今日总调用 ${gatewayStatus.calls_today || 0} 次；数据来自本地网关。</div>`;
  renderBudgetCard();
}
async function loadBalances() {
  const box = $('#balance-list');
  box.innerHTML = '<div class="muted">查询中…</div>';
  const r = await A.getBalances();
  if (!r.ok) { box.innerHTML = '<div class="muted">查询失败：' + escapeHtml(r.error) + '</div>'; return; }
  const d = r.data || {};
  if (!d.ok) { box.innerHTML = '<div class="muted">查询失败</div>'; return; }
  const items = d.balances || [];
  if (!items.length) { box.innerHTML = '<div class="muted">还没有模型</div>'; return; }
  box.innerHTML = items.map((b) => {
    if (b.kind === 'deepseek') {
      const info = (b.infos || []).map((i) => `${i.currency} ¥${i.total}（充值 ${i.topped}，赠送 ${i.granted}）`).join('；') || '查询不到';
      return `<div class="usage-row"><span>${escapeHtml(b.name)}</span><span>${escapeHtml(info)}</span><span class="num ok">官方余额</span></div>`;
    }
    return `<div class="usage-row"><span>${escapeHtml(b.name)}</span><span class="muted">余额请到中转站控制台查看</span><span class="num"><button class="btn" data-url="${escapeHtml(b.console || '')}">打开控制台</button></span></div>`;
  }).join('');
  $('#balance-time').textContent = '更新于 ' + new Date().toLocaleTimeString();
}
$('#balance-refresh').addEventListener('click', loadBalances);
$('#balance-list').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-url]');
  if (b && b.dataset.url) A.openUrl(b.dataset.url);
});

$('#cfg-refresh').addEventListener('click', refreshUsage);
$('#model-reload').addEventListener('click', loadModelConfig);

async function saveModelAll() {
  const out = $('#cfg-result');
  if (!modelCfg) return;
  modelCfg.global.daily_budget = Number($('#g-budget').value) || 0;
  modelCfg.global.alert_ratio = Number($('#g-alert').value) || 0.8;
  if (!modelCfg.models.length) { out.textContent = '至少先添加一个模型。'; return; }
  setText('#model-save-state', '保存中…', 'warn');
  out.textContent = '正在保存并重启网关 / AstrBot…（约 10 秒，QQ 不掉线）';
  const r = await A.saveModelConfig(modelCfg);
  out.textContent = r.ok ? '✅ 已生效。\n' + r.text : '❌ 失败：' + r.error;
  if (r.ok) {
    setText('#model-save-state', '已保存并生效', 'ok');
    refreshUsage();
    refreshStatus();
    loadBalances();
  } else {
    setText('#model-save-state', '保存失败', 'bad');
  }
}
$('#cfg-save').addEventListener('click', saveModelAll);
$('#model-save-top').addEventListener('click', saveModelAll);
$('#g-budget').addEventListener('input', markModelDirty);
$('#g-alert').addEventListener('input', markModelDirty);

// ---------------- backup ----------------
async function loadBackups() {
  const r = await A.listBackups();
  if (!r.ok) { $('#backup-result').textContent = '读取失败：' + r.error; return; }
  $('#bk-dir').textContent = r.dir;
  $('#bk-count').textContent = r.files.length + ' 份';
  if (r.files.length) {
    $('#bk-last').textContent = new Date(r.files[0].mtime).toLocaleString();
    $('#bk-last-size').textContent = r.files[0].sizeMB + ' MB';
  } else {
    $('#bk-last').textContent = '还没有';
    $('#bk-last-size').textContent = '';
  }
  $('#backup-tbl tbody').innerHTML = r.files.length ? r.files.map((f) => `
    <tr><td>${escapeHtml(f.name)}</td><td>${f.sizeMB} MB</td><td>${new Date(f.mtime).toLocaleString()}</td>
    <td><button class="btn" data-open="${escapeHtml(r.dir + '/' + f.name)}">打开所在位置</button></td></tr>`).join('')
    : '<tr><td colspan="4" class="muted">还没有本地备份，点右上角“立即备份并下载”</td></tr>';
}
$('#backup-refresh').addEventListener('click', loadBackups);
$('#backup-run').addEventListener('click', async () => {
  const out = $('#backup-result'); const btn = $('#backup-run');
  btn.disabled = true; out.textContent = '正在备份并下载，可能需要 1–3 分钟…';
  try {
    const r = await A.runBackup();
    out.textContent = r.ok ? `✅ 备份完成\n本地文件：${r.local}\n大小：${r.sizeMB} MB` : '❌ 失败：' + r.error;
    if (r.ok) loadBackups();
  } finally { btn.disabled = false; }
});
$('#backup-open').addEventListener('click', async () => {
  const r = await A.listBackups();
  if (r.ok) A.openDir(r.dir);
});
$('#backup-tbl').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-open]');
  if (b) A.openPath(b.dataset.open);
});

// ---------------- settings ----------------
async function loadConfigToUI() {
  cfg = await A.getConfig();
  $('#s-host').value = cfg.host || '';
  $('#s-port').value = cfg.port || 22;
  $('#s-user').value = cfg.user || 'root';
  $('#s-key').value = cfg.keyPath || '';
  $('#s-uin').value = cfg.uin || '';
  $('#s-backup').value = cfg.backupDir || '';
  $('#login-uin').textContent = cfg.uin || '-';
}
$('#s-save').addEventListener('click', async () => {
  cfg = await A.saveConfig({
    host: $('#s-host').value.trim(),
    port: Number($('#s-port').value) || 22,
    user: $('#s-user').value.trim(),
    keyPath: $('#s-key').value.trim(),
    uin: $('#s-uin').value.trim(),
    backupDir: $('#s-backup').value.trim(),
  });
  $('#s-result').textContent = '已保存。';
  $('#login-uin').textContent = cfg.uin || '-';
});
$('#s-test').addEventListener('click', async () => {
  $('#s-result').textContent = '连接中…';
  const r = await A.testSsh();
  $('#s-result').textContent = r.ok ? '✅ 连接成功\n' + r.text : '❌ 连接失败：' + r.error;
});

// ---------------- utils ----------------
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------------- init ----------------
(async () => {
  await loadConfigToUI();
  refreshStatus();
  setAutoStatus(true);
  refreshLogs();
  setAutoLogs(false);
  const want = new URLSearchParams(location.search).get('tab');
  if (want) {
    const btn = document.querySelector(`nav button[data-tab="${want}"]`);
    if (btn) btn.click();
  }
  const sc = new URLSearchParams(location.search).get('scroll');
  if (sc) setTimeout(() => { const m = document.querySelector('main'); if (m) m.scrollTop = Number(sc) || 0; }, 1500);
})();
