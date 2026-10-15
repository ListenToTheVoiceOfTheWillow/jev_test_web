const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8787);
const ENV_PATH = path.join(ROOT, '.env');
const os = require('node:os');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const execFileAsync = promisify(execFile);

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs.readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && line.includes('='))
      .map(line => {
        const index = line.indexOf('=');
        const key = line.slice(0, index).trim();
        let value = line.slice(index + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        return [key, value];
      })
  );
}

const fileEnv = loadEnv(ENV_PATH);
const apiKey = process.env.TYPESAFE_API_KEY || fileEnv.TYPESAFE_API_KEY;
const pythonExecutable = process.env.JEV_PYTHON || 'E:/secondsoft/myclaudeenv/venv/Scripts/python.exe';
const whisperModel = process.env.WHISPER_MODEL_SIZE || 'tiny';
const whisperCache = process.env.WHISPER_MODEL_CACHE || 'E:/secondsoft/myclaudeenv/models/huggingface/hub';
function statusLog(message) { console.log('[jev]', message); }

async function transcribeAudio(file) {
  if (!file || typeof file.arrayBuffer !== 'function') {
    throw new Error('未收到有效的音频文件。');
  }
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jev-audio-'));
  const extension = path.extname(file.name || '') || '.webm';
  const audioPath = path.join(tempDir, `input${extension}`);
  try {
    fs.writeFileSync(audioPath, Buffer.from(await file.arrayBuffer()));
    const helper = path.join(ROOT, 'transcribe_audio.py');
    const { stdout } = await execFileAsync(pythonExecutable, [helper, audioPath], {
      cwd: ROOT,
      timeout: 180_000,
      maxBuffer: 2_000_000,
      windowsHide: true,
      env: { ...process.env, WHISPER_MODEL_SIZE: whisperModel, WHISPER_MODEL_CACHE: whisperCache }
    });
    let result;
    try { result = JSON.parse(stdout.trim()); } catch { throw new Error('语音转写程序返回了无法解析的结果。'); }
    if (!result.ok) throw new Error(result.error || '语音转写失败。');
    if (!result.text) throw new Error('音频中没有识别到可用语音。');
    return result;
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error(`找不到本地语音转写环境：${pythonExecutable}`);
    throw error;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

const INDEX_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Jev 判断助手</title>
  <style>
    :root { color-scheme: light; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
    body { margin: 0; min-height: 100vh; background: #f4f7fb; color: #172033; }
    main { width: min(760px, calc(100% - 32px)); margin: 48px auto; }
    .card { background: white; border: 1px solid #e2e8f0; border-radius: 18px; padding: 28px; box-shadow: 0 12px 35px #1e293b12; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    .hint { margin: 0 0 24px; color: #64748b; }
    label { display: block; margin: 18px 0 8px; font-weight: 650; }
    textarea, input { box-sizing: border-box; width: 100%; border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px 13px; font: inherit; }
    textarea { min-height: 120px; resize: vertical; }
    .audio-box { padding: 14px; border: 1px dashed #cbd5e1; border-radius: 10px; background: #f8fafc; }
    .audio-box input { padding: 8px; background: white; }
    .audio-help, .audio-name { display: block; margin-top: 7px; color: #64748b; font-size: 13px; }
    audio { width: 100%; margin-top: 10px; }
    .options { display: grid; gap: 10px; }
    .option { display: flex; gap: 8px; align-items: center; }
    .option input { flex: 1; }
    .option button { border: 0; background: #eef2ff; color: #3730a3; border-radius: 8px; padding: 9px 11px; cursor: pointer; }
    .actions { display: flex; gap: 10px; margin-top: 22px; }
    button.primary { border: 0; border-radius: 10px; padding: 12px 18px; background: #4f46e5; color: white; font-weight: 700; cursor: pointer; }
    button.primary:disabled { opacity: .6; cursor: wait; }
    button.secondary { border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px 18px; background: white; cursor: pointer; }
    #status { margin-top: 18px; color: #64748b; white-space: pre-wrap; }
    .result { margin-top: 18px; padding: 16px; border-radius: 12px; background: #f8fafc; border: 1px solid #e2e8f0; }
    .choice { font-size: 22px; font-weight: 750; color: #312e81; }
    .meta { color: #64748b; margin-top: 6px; }
    table { width: 100%; margin-top: 14px; border-collapse: collapse; }
    td { padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
    td:last-child { text-align: right; font-variant-numeric: tabular-nums; }
    .error { color: #b91c1c; }
  </style>
</head>
<body>
  <main>
    <section class="card">
      <h1>Jev 判断助手</h1>
      <p class="hint">输入一段内容，让 Jev 从固定选项中选择最合适的结果。</p>
      <label for="message">要判断的内容</label>
      <textarea id="message" placeholder="例如：帮我分析今天是否上班？"></textarea>
      <label for="audio">或输入音频</label>
      <div class="audio-box">
        <input id="audio" type="file" accept="audio/*,.webm,.wav,.mp3,.m4a,.ogg" />
        <span id="audio-name" class="audio-name">未选择音频。音频会先在本机转写，再交给 Jev 大模型判断。</span>
        <audio id="audio-preview" controls hidden></audio>
      </div>
      <label>判断选项</label>
      <div id="options" class="options"></div>
      <div class="actions">
        <button id="decide" class="primary">交给 Jev 判断</button>
        <button id="add" class="secondary" type="button">添加选项</button>
      </div>
      <div id="status" role="status"></div>
      <div id="result" class="result" hidden></div>
    </section>
  </main>
  <script>
    const defaultOptions = ['直接回答', '询问用户', '不上班'];
    const optionsEl = document.querySelector('#options');
    const messageEl = document.querySelector('#message');
    const resultEl = document.querySelector('#result');
    const statusEl = document.querySelector('#status');
    const decideBtn = document.querySelector('#decide');
    const audioEl = document.querySelector('#audio');
    const audioNameEl = document.querySelector('#audio-name');
    const audioPreviewEl = document.querySelector('#audio-preview');
    let audioPreviewUrl = '';

    audioEl.onchange = () => {
      const file = audioEl.files[0];
      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
      audioPreviewUrl = '';
      audioPreviewEl.hidden = true;
      if (!file) {
        audioNameEl.textContent = '未选择音频。音频会先在本机转写，再交给 Jev 大模型判断。';
        return;
      }
      audioNameEl.textContent = file.name + '（' + Math.ceil(file.size / 1024) + ' KB）';
      audioPreviewUrl = URL.createObjectURL(file);
      audioPreviewEl.src = audioPreviewUrl;
      audioPreviewEl.hidden = false;
    };

    function addOption(value = '') {
      const row = document.createElement('div');
      row.className = 'option';
      row.innerHTML = '<input maxlength="80" placeholder="选项名称"> <button type="button" title="删除">删除</button>';
      row.querySelector('input').value = value;
      row.querySelector('button').onclick = () => { if (optionsEl.children.length > 2) row.remove(); };
      optionsEl.appendChild(row);
    }
    defaultOptions.forEach(addOption);
    document.querySelector('#add').onclick = () => addOption();

    function showResult(data) {
      const answer = data.answers.decision;
      const rows = Object.entries(answer.probabilities || {}).map(([key, value]) =>
        '<tr><td>' + escapeHtml(key) + '</td><td>' + (Number(value) * 100).toFixed(1) + '%</td></tr>'
      ).join('');
      resultEl.innerHTML = '<div class="choice">' + escapeHtml(answer.choice) + '</div>'
        + '<div class="meta">整体置信度：' + (Number(answer.confidence) * 100).toFixed(1) + '%</div>'
        + '<div class="meta">分析链路：' + (data.input?.source === 'audio'
          ? '音频 → 本机 Whisper 转写 → Jev 大模型判断'
          : '文本 → Jev 大模型判断') + '</div>'
        + (data.input?.transcript ? '<div class="meta">音频转写：' + escapeHtml(data.input.transcript) + '</div>' : '')
        + '<div class="meta">各选项概率（所有选项加起来为 100%）</div>'
        + '<table><thead><tr><td>选项</td><td>概率</td></tr></thead><tbody>' + rows + '</tbody></table>';
      resultEl.hidden = false;
    }
    function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;', '"':'&quot;'}[c])); }

    decideBtn.onclick = async () => {
      const message = messageEl.value.trim();
      const audio = audioEl.files[0];
      const options = [...optionsEl.querySelectorAll('input')].map(input => input.value.trim()).filter(Boolean);
      if (!message && !audio) { statusEl.textContent = '请先输入文字或选择音频。'; statusEl.className = 'error'; return; }
      if (options.length < 2) { statusEl.textContent = '至少需要两个判断选项。'; statusEl.className = 'error'; return; }
      decideBtn.disabled = true; resultEl.hidden = true; statusEl.className = '';
      statusEl.textContent = audio ? '正在本机转写音频，随后交给 Jev 判断…' : 'Jev 正在判断…';
      try {
        let request;
        if (audio) {
          const body = new FormData();
          body.append('message', message);
          body.append('options', JSON.stringify(options));
          body.append('audio', audio, audio.name);
          request = { method: 'POST', body };
        } else {
          request = { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ message, options }) };
        }
        const response = await fetch('/api/decide', request);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '请求失败');
        showResult(data); statusEl.textContent = '判断完成';
      } catch (error) { statusEl.textContent = '判断失败：' + error.message; statusEl.className = 'error'; }
      finally { decideBtn.disabled = false; }
    };
  </script>
</body>
</html>`;

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 100_000) reject(new Error('请求内容过大'));
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function readDecisionInput(req) {
  const contentType = String(req.headers['content-type'] || '');
  if (contentType.toLowerCase().startsWith('multipart/form-data')) {
    const request = new Request('http://jev.local/api/decide', {
      method: 'POST',
      headers: req.headers,
      body: req,
      duplex: 'half'
    });
    const form = await request.formData();
    const rawOptions = form.get('options');
    let options = [];
    try { options = JSON.parse(String(rawOptions || '[]')); } catch { options = []; }
    const audio = form.get('audio');
    return { message: String(form.get('message') || ''), options, audio };
  }
  const input = JSON.parse(await readBody(req));
  return { message: input.message, options: input.options, audio: null };
}

async function decide(req, res) {
  if (!apiKey) return sendJson(res, 500, { error: '未找到 TYPESAFE_API_KEY，请检查 .env 文件。' });
  try {
    const input = await readDecisionInput(req);
    let message = typeof input.message === 'string' ? input.message.trim() : '';
    const options = Array.isArray(input.options) ? input.options.map(String).map(x => x.trim()).filter(Boolean) : [];
    if (!message && !input.audio) return sendJson(res, 400, { error: '请输入文字或上传音频。' });
    if (options.length < 2 || options.length > 255) return sendJson(res, 400, { error: '选项数量必须在 2 到 255 个之间。' });
    let audioInput = null;
    if (input.audio) {
      if (typeof input.audio.arrayBuffer !== 'function' || !input.audio.size) {
        return sendJson(res, 400, { error: '上传的音频为空或格式无效。' });
      }
      statusLog('audio received: ' + input.audio.name + ' (' + input.audio.size + ' bytes)');
      audioInput = await transcribeAudio(input.audio);
      message = [message, audioInput.text].filter(Boolean).join('\n\n');
    }
    const criteria = Object.fromEntries(options.map(option => [option, '选择这个选项，当它最符合用户内容的处理方式或结论。']));
    const upstream = await fetch('https://api.typesafe.ai/v1/systemone', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'jev-latest',
        state: { message, input_type: audioInput ? 'audio_transcript' : 'text' },
        questions: { decision: {
          type: 'choice',
          instructions: '根据用户输入，从给定的固定选项中选择最合适的一个。只依据输入内容和选项含义判断。',
          criteria
        }}
      })
    });
    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { error: text || 'TypeSafe 返回了无法解析的响应。' }; }
    if (!upstream.ok) return sendJson(res, upstream.status, { error: data.error || data.message || 'TypeSafe 请求失败。' });
    data.input = audioInput
      ? { source: 'audio', transcript: audioInput.text, transcription_model: audioInput.model || whisperModel,
          analysis_model: 'jev-latest' }
      : { source: 'text', analysis_model: 'jev-latest' };
    sendJson(res, 200, data);
  } catch (error) {
    sendJson(res, 500, { error: error.message || '服务器错误。' });
  }
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(INDEX_HTML);
  }
  if (req.method === 'POST' && req.url === '/api/decide') return decide(req, res);
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('Jev 判断助手已启动: http://127.0.0.1:' + PORT);
});
