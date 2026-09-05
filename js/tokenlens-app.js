let currentTheme = 'light';
let analyzeTimer = null;
let lastIds = null;
let lastText = '';

const MODELS = [
    { id: 'gpt-4o', name: 'GPT-4o', sub: 'o200k_base', family: 'openai', inP: 2.50, outP: 10.00 },
    { id: 'gpt-4.1', name: 'GPT-4.1', sub: 'o200k_base', family: 'openai', inP: 2.00, outP: 8.00 },
    { id: 'claude-4-sonnet', name: 'Claude 4 Sonnet', sub: 'est. vs GPT o200k x 1.05', family: 'claude', inP: 3.00, outP: 15.00 },
    { id: 'claude-4-opus', name: 'Claude 4 Opus', sub: 'est. vs GPT o200k x 1.05', family: 'claude', inP: 15.00, outP: 75.00 },
    { id: 'claude-3.5', name: 'Claude 3.5 Sonnet', sub: 'est. vs GPT o200k x 1.05', family: 'claude', inP: 3.00, outP: 15.00 },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', sub: 'SentencePiece-style estimate, <=200k list', family: 'gemini', inP: 1.25, outP: 10.00 },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', sub: 'SentencePiece-style estimate', family: 'gemini', inP: 0.30, outP: 2.50 }
];

const SAMPLE = [
    'SYSTEM:',
    'You are a senior staff engineer reviewing a production pull request. Be precise, cite code, and flag security, performance, and API-contract risks. Prefer a concrete patched function over general advice. Do not invent APIs.',
    '',
    'USER:',
    'Review this TypeScript rate-limiter on Cloudflare Workers + KV.',
    '',
    '```ts',
    'export async function rateLimit(req: Request, env: Env): Promise<Response | null> {',
    '  const ip = req.headers.get("cf-connecting-ip") ?? "unknown";',
    '  const key = `rl:${ip}`;',
    '  const n = await env.KV.get(key);',
    '  const count = n ? parseInt(n, 10) + 1 : 1;',
    '  await env.KV.put(key, String(count), { expirationTtl: 60 });',
    '  if (count > 100) return new Response("Too Many Requests", { status: 429 });',
    '  return null;',
    '}',
    '```',
    '',
    'Constraints:',
    '- We serve Japanese and English traffic. Error copy may include \u65e5\u672c\u8a9e.',
    '- Do not log raw IPs.',
    '- Return a unified JSON error envelope: { "error": { "code", "message" } }.',
    '',
    'Please (1) list bugs, (2) propose a patched function, (3) keep the reply short.'
].join('\n');

function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', currentTheme);
    const icon = document.querySelector('.theme-toggle i');
    icon.className = currentTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    localStorage.setItem('tools-theme', currentTheme);
    localStorage.setItem('tokenlens-theme', currentTheme);
}

function loadTheme() {
    const saved = localStorage.getItem('tools-theme') || localStorage.getItem('tokenlens-theme') || 'light';
    currentTheme = saved;
    document.body.setAttribute('data-theme', currentTheme);
    const icon = document.querySelector('.theme-toggle i');
    if (icon) icon.className = currentTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
}

function isCJK(cp) {
    return (cp >= 0x3040 && cp <= 0x30FF) ||
           (cp >= 0x3400 && cp <= 0x9FFF) ||
           (cp >= 0xF900 && cp <= 0xFAFF) ||
           (cp >= 0xAC00 && cp <= 0xD7AF) ||
           (cp >= 0x20000 && cp <= 0x2CEAF);
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function countWords(text) {
    const m = text.trim().match(/[A-Za-z0-9]+(?:['\u2019-][A-Za-z0-9]+)*|[\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]+/g);
    return m ? m.length : 0;
}

function estimateGpt(text) {
    if (!text) return 0;
    let tokens = 0;
    const parts = text.split(/(\s+)/);
    for (const part of parts) {
        if (!part) continue;
        if (/^\s+$/.test(part)) {
            tokens += (part.match(/\n/g) || []).length;
            continue;
        }
        let cjk = 0, ascii = 0, other = 0;
        for (const ch of part) {
            const cp = ch.codePointAt(0);
            if (isCJK(cp)) cjk += 1;
            else if (cp <= 0x7F) ascii += 1;
            else other += 1;
        }
        tokens += cjk + other + Math.ceil(ascii / 4);
    }
    return Math.max(1, tokens);
}

function estimateGemini(text) {
    if (!text) return 0;
    let n = 0;
    for (const ch of text) {
        const cp = ch.codePointAt(0);
        if (isCJK(cp)) n += 1;
        else if (ch === '\n') n += 1;
        else n += 0.25;
    }
    return Math.max(1, Math.round(n));
}

function encodeExact(text) {
    const tok = window.__gptTok;
    if (!tok || typeof tok.encode !== 'function') return null;
    try {
        return tok.encode(text, { allowedSpecial: 'all' });
    } catch (e1) {
        try { return tok.encode(text); }
        catch (e2) { return null; }
    }
}

function decodeIds(ids) {
    const tok = window.__gptTok;
    if (!tok || typeof tok.decode !== 'function') return null;
    try { return ids.map(function (id) { return tok.decode([id]); }); }
    catch (e) { return null; }
}

function tokenDensity(piece) {
    if (!piece) return 0;
    if (/^\s+$/.test(piece)) return 0;
    let cjk = 0, code = 0, len = 0;
    for (const ch of piece) {
        len += 1;
        const cp = ch.codePointAt(0);
        if (isCJK(cp)) cjk += 1;
        else if (!/[A-Za-z0-9\s]/.test(ch)) code += 1;
    }
    const score = cjk * 2.4 + code * 1.2 + Math.min(len, 16) * 0.35;
    if (score < 1.2) return 0;
    if (score < 2.4) return 1;
    if (score < 4.0) return 2;
    if (score < 6.5) return 3;
    return 4;
}

function fmtUsd(n) {
    if (!isFinite(n) || n <= 0) return '$0.00';
    if (n < 0.0001) return '<$0.0001';
    if (n < 0.01) return '$' + n.toFixed(4);
    if (n < 1) return '$' + n.toFixed(4);
    return '$' + n.toFixed(2);
}

function fmtInt(n) {
    return Number(n || 0).toLocaleString();
}

function setTokStatus() {
    const el = document.getElementById('tokStatus');
    if (window.__gptTok) {
        el.textContent = 'Exact o200k';
        el.className = 'pill ok';
    } else {
        el.textContent = 'Estimate (no tokenizer)';
        el.className = 'pill warn';
    }
}

function onPromptInput() {
    const text = document.getElementById('promptInput').value;
    document.getElementById('charStatus').textContent = text.length.toLocaleString() + ' characters';
    clearTimeout(analyzeTimer);
    analyzeTimer = setTimeout(function () { analyze(text); }, 80);
}

function analyze(text) {
    lastText = text;
    const chars = text.length;
    const words = countWords(text);
    const ids = encodeExact(text);
    lastIds = ids;
    const gptTokens = ids ? ids.length : (text ? estimateGpt(text) : 0);
    const gptExact = Boolean(ids);
    const claudeTokens = text ? Math.max(1, Math.round(gptTokens * 1.05)) : 0;
    const geminiTokens = text ? estimateGemini(text) : 0;
    const tpw = words ? (gptTokens / words) : 0;

    document.getElementById('statChars').textContent = fmtInt(chars);
    document.getElementById('statWords').textContent = fmtInt(words);
    document.getElementById('statTokens').textContent = fmtInt(gptTokens);
    document.getElementById('statTPW').textContent = words ? tpw.toFixed(2) : '0';

    const status = document.getElementById('inputStatus');
    if (!text) status.textContent = 'Ready';
    else if (gptExact) status.textContent = 'o200k_base \u00b7 ' + fmtInt(gptTokens) + ' tokens';
    else status.textContent = 'Heuristic estimate \u00b7 ' + fmtInt(gptTokens) + ' tokens';

    const counts = { openai: gptTokens, claude: claudeTokens, gemini: geminiTokens, gptExact: gptExact };
    renderModelRows(counts);
    renderCosts(counts);
    renderHeatmap(text, ids);
}

function renderModelRows(counts) {
    const host = document.getElementById('modelRows');
    host.innerHTML = MODELS.map(function (m) {
        const n = counts[m.family] || 0;
        const kind = m.family === 'openai' ? (counts.gptExact ? 'exact' : 'estimate') : 'estimate';
        const kindClass = kind === 'exact' ? 'ok' : 'warn';
        return '<div class="model-row"><div><div class="model-name">' + escapeHtml(m.name) +
            '</div><div class="model-sub">' + escapeHtml(m.sub) +
            '</div></div><div class="model-tokens">' + fmtInt(n) +
            '</div><div class="model-kind"><span class="pill ' + kindClass + '">' + kind +
            '</span></div></div>';
    }).join('');
}

function currentCounts() {
    const text = lastText;
    const gptTokens = lastIds ? lastIds.length : (text ? estimateGpt(text) : 0);
    return {
        openai: gptTokens,
        claude: text ? Math.max(1, Math.round(gptTokens * 1.05)) : 0,
        gemini: text ? estimateGemini(text) : 0,
        gptExact: Boolean(lastIds)
    };
}

function renderCosts(counts) {
    counts = counts || currentCounts();
    const outEl = document.getElementById('outTokens');
    const outTok = Math.max(0, parseInt(outEl.value, 10) || 0);
    const rows = MODELS.map(function (m) {
        const inn = counts[m.family] || 0;
        const inCost = inn * m.inP / 1e6;
        const outCost = outTok * m.outP / 1e6;
        return '<tr><td>' + escapeHtml(m.name) +
            '<div class="model-sub">$' + m.inP.toFixed(2) + ' / $' + m.outP.toFixed(2) +
            ' per 1M</div></td><td class="num">' + fmtUsd(inCost) +
            '</td><td class="num">' + fmtUsd(outCost) +
            '</td><td class="num total">' + fmtUsd(inCost + outCost) + '</td></tr>';
    }).join('');
    document.getElementById('priceTable').innerHTML =
        '<thead><tr><th>Model</th><th class="num">Input</th><th class="num">Output</th><th class="num">Total</th></tr></thead><tbody>' +
        rows + '</tbody>';
}

function renderHeatmap(text, ids) {
    const heat = document.getElementById('heatmap');
    const strip = document.getElementById('lineStrip');
    if (!text) {
        heat.innerHTML = '<div class="empty-hint">Paste a prompt to color tokens by density.</div>';
        strip.innerHTML = '';
        return;
    }
    const MAX = 4000;
    let html = '';
    if (ids && ids.length && window.__gptTok) {
        const pieces = decodeIds(ids.slice(0, MAX));
        if (pieces) {
            html = pieces.map(function (p) {
                return '<span class="heat-span heat-' + tokenDensity(p) + '">' + escapeHtml(p) + '</span>';
            }).join('');
            if (ids.length > MAX) {
                html += '<div class="model-sub" style="margin-top:0.5rem;">Showing first ' +
                    MAX.toLocaleString() + ' of ' + ids.length.toLocaleString() + ' tokens.</div>';
            }
        }
    }
    if (!html) {
        html = text.split(/(\s+)/).map(function (p) {
            if (!p) return '';
            if (/^\s+$/.test(p)) return escapeHtml(p);
            return '<span class="heat-span heat-' + tokenDensity(p) + '">' + escapeHtml(p) + '</span>';
        }).join('');
    }
    heat.innerHTML = html;

    const lines = text.split('\n');
    const maxN = Math.max(1, ...lines.map(function (ln) { return ln.length; }));
    strip.innerHTML = lines.slice(0, 200).map(function (ln) {
        const dens = tokenDensity(ln.replace(/\s+/g, ' ').trim() || ln);
        const h = 8 + Math.round(28 * Math.min(1, ln.length / maxN));
        return '<div class="line-bar heat-' + dens + '" style="height:' + h + 'px" title="' + ln.length + ' chars"></div>';
    }).join('');
}

function loadSample() {
    document.getElementById('promptInput').value = SAMPLE;
    onPromptInput();
    document.getElementById('inputStatus').textContent = 'Sample prompt loaded';
}

function clearPrompt() {
    document.getElementById('promptInput').value = '';
    lastIds = null;
    lastText = '';
    onPromptInput();
    document.getElementById('inputStatus').textContent = 'Cleared';
}

window.addEventListener('tokenizer-ready', function () {
    setTokStatus();
    analyze(document.getElementById('promptInput').value);
});

document.addEventListener('DOMContentLoaded', function () {
    loadTheme();
    setTokStatus();
    renderModelRows(currentCounts());
    renderCosts();
    setTimeout(function () {
        if (!window.__gptTok) setTokStatus();
    }, 4000);
});
