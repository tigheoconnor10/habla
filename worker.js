// ─── RSS + Analysis helpers ───────────────────────────────────────────────────
const RSS_SOURCES = {
  bbc:     { name: "BBC Mundo",      flag: "🌎", url: "https://feeds.bbci.co.uk/mundo/rss.xml" },
  elpais:  { name: "El País",        flag: "🇪🇸", url: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada" },
  elmundo: { name: "El Mundo",       flag: "🇪🇸", url: "https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml" },
  infobae: { name: "Infobae",        flag: "🇦🇷", url: "https://www.infobae.com/feeds/rss/" },
  cnn:     { name: "CNN en Español", flag: "📺",  url: "https://cnnespanol.cnn.com/feed/" },
};
const DEFAULT_SOURCES = ["bbc", "elpais"];
const DEFAULT_BATCH_SIZE = 12;
const MAX_BATCH_SIZE = 25;
const ARTICLE_HOST_ALLOWLIST = [
  "bbc.com",
  "bbc.co.uk",
  "bbci.co.uk",
  "elpais.com",
  "elmundo.es",
  "infobae.com",
  "cnn.com",
];
function stripHtml(html) {
  return (html || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x([0-9a-fA-F]+);/g, function(_, hex) {
      try { return String.fromCodePoint(parseInt(hex, 16)); } catch (e) { return ""; }
    })
    .replace(/&#(\d+);/g, function(_, dec) {
      try { return String.fromCodePoint(parseInt(dec, 10)); } catch (e) { return ""; }
    })
    .replace(/\s+/g, " ")
    .trim();
}
function isNoiseParagraph(text) {
  return (
    /compartir en (whatsapp|facebook|twitter|linkedin|bluesky)/i.test(text) ||
    /^(foto|vídeo|video|photo|image|crédito|credit)\s*:/i.test(text) ||
    /copiar enlace/i.test(text) ||
    /ir a los comentarios/i.test(text) ||
    [/whatsapp/i, /facebook/i, /twitter/i, /linkedin/i, /bluesky/i]
      .filter(function(pattern) { return pattern.test(text); })
      .length >= 2 ||
    /"\w+"\s*:\s*(?:"[^"]*"|true|false|\d+)\s*,\s*"\w+"\s*:/.test(text) ||
    /\}\s*\)\s*;/.test(text)
  );
}
function hashString(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function stableItemSortValue(item) {
  const base = [item.sourceId, item.link, item.title, item.content].filter(Boolean).join("::");
  return String(hashString(base)).padStart(10, "0") + "::" + base;
}
function validateArticleUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch (e) {
    return null;
  }
  if (!/^https?:$/.test(parsed.protocol)) return null;
  const hostname = parsed.hostname.toLowerCase();
  const allowed = ARTICLE_HOST_ALLOWLIST.some(function(host) {
    return hostname === host || hostname.endsWith("." + host);
  });
  return allowed ? parsed.toString() : null;
}
function parseRSS(xml, srcId) {
  const src = RSS_SOURCES[srcId];
  const items = [];
  const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  const entryRegex = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
  const blocks = [];
  let m;
  while ((m = itemRegex.exec(xml)) !== null) blocks.push(m[1]);
  while ((m = entryRegex.exec(xml)) !== null) blocks.push(m[1]);
  for (const block of blocks) {
    function getTag(tag) {
      const match = block.match(new RegExp("<" + tag + "[^>]*>([\\s\\S]*?)<\\/" + tag + ">", "i"));
      return match ? stripHtml(match[1]) : "";
    }
    const title = getTag("title");
    const desc =
      getTag("description") ||
      getTag("summary") ||
      getTag("content:encoded") ||
      getTag("content");
    const linkMatch =
      block.match(/<link\b[^>]*>([\s\S]*?)<\/link>/i) ||
      block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
    const link = linkMatch ? stripHtml(linkMatch[1]) : "";
    const content = (desc && desc.length > 80 ? desc : title).slice(0, 500);
    if (content.length > 60) {
      items.push({
        id: link || (srcId + "::" + title + "::" + content.slice(0, 60)),
        link: link || "",
        sourceId: srcId,
        source: src.name,
        flag: src.flag,
        title: title.slice(0, 140),
        content: content
      });
    }
  }
  return items;
}
function dedupeItems(items) {
  const seen = new Set();
  return items.filter(function(item) {
    const key = item.link || (item.sourceId + "::" + item.title + "::" + item.content);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function encodeCursor(data) {
  return btoa(JSON.stringify(data));
}
function decodeCursor(cursor) {
  if (!cursor) return { offset: 0 };
  try {
    return JSON.parse(atob(cursor));
  } catch (e) {
    return { offset: 0 };
  }
}
async function fetchSource(id) {
  const src = RSS_SOURCES[id];
  if (!src) return [];
  try {
    const r = await fetch(src.url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      cf: { cacheTtl: 900, cacheEverything: true }
    });
    if (!r.ok) return [];
    const xml = await r.text();
    return parseRSS(xml, id);
  } catch (e) {
    return [];
  }
}
async function getFeedsPage(sourceIds, cursor, batchSize) {
  const validSources = sourceIds.filter(function(id) {
    return !!RSS_SOURCES[id];
  });
  const results = await Promise.all(validSources.map(fetchSource));
  let all = [];
  results.forEach(function(items) {
    all = all.concat(items);
  });
  all = dedupeItems(all);
  all = all.slice().sort(function(a, b) {
    const aKey = stableItemSortValue(a);
    const bKey = stableItemSortValue(b);
    if (aKey < bKey) return -1;
    if (aKey > bKey) return 1;
    return 0;
  });
  const state = decodeCursor(cursor);
  const offset = Math.max(0, state.offset || 0);
  const items = all.slice(offset, offset + batchSize);
  const nextOffset = offset + items.length;
  const nextCursor = nextOffset < all.length ? encodeCursor({ offset: nextOffset }) : null;
  return {
    items,
    nextCursor,
    hasMore: !!nextCursor,
    totalAvailable: all.length
  };
}
async function analyzeContent(content, apiKey, modelName) {
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY secret");
  }
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: modelName || "claude-sonnet-4-6",
      max_tokens: 1024,
      temperature: 0.2,
      messages: [
        {
          role: "user",
          content:
            "Analyze this Spanish news text for an English speaker learning Spanish.\n\n" +
            "Return ONLY valid JSON with keys: translation, register, highlights, tip.\n" +
            "highlights must be an array of objects with keys: phrase, meaning, note.\n\n" +
            'Text:\n"' + content.slice(0, 400) + '"'
        }
      ]
    })
  });
  const d = await r.json();
  if (!r.ok) {
    throw new Error(d?.error?.message || "Anthropic request failed");
  }
  const text = (d.content || [])
    .filter(function(block) { return block.type === "text" && block.text; })
    .map(function(block) { return block.text; })
    .join("\n")
    .trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model did not return valid JSON");
  }
  return JSON.parse(text.slice(start, end + 1));
}
async function lookupVocab(word, context, apiKey) {
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY secret");
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      temperature: 0.2,
      messages: [{
        role: "user",
        content: `The Spanish word or phrase "${word}" appears in this context: "${context}"\n\nReturn ONLY valid JSON with keys:\n- translation: concise English translation of just this word/phrase\n- explanation: 2-3 sentences explaining the meaning, usage, grammar notes, or cultural context. Reference how it is used in the given sentence.`
      }]
    })
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error?.message || "Request failed");
  const text = (d.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Invalid response");
  return JSON.parse(text.slice(start, end + 1));
}
// ─── The App HTML ──────────────────────────────────────────────────────────────
function getHTML() {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="theme-color" content="#f5f0e8">
<title>habla.</title>
<link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,700;1,400&family=DM+Sans:wght@400;600&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
body{background:#f5f0e8;font-family:'Crimson Pro',Georgia,serif;color:#1a1410;min-height:100vh}
.screen{display:none;flex-direction:column;align-items:center;min-height:100vh}
.screen.active{display:flex}
.topbar{width:100%;max-width:480px;display:flex;justify-content:space-between;align-items:center;padding:18px 20px 0}
.logo{font-size:22px;font-weight:700;cursor:pointer}
.logo em{color:#c0392b;font-style:normal}
.nav button{font-family:'DM Sans',sans-serif;background:none;border:none;cursor:pointer;font-size:12px;color:#7a6a5a;text-transform:uppercase;letter-spacing:.5px;padding:4px 5px}
.body{width:100%;max-width:480px;padding:20px;flex:1}
.lbl{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9a8a7a;margin-bottom:10px;font-family:'DM Sans',sans-serif}
h1{font-size:36px;font-weight:700;line-height:1.1;letter-spacing:-1px;margin-bottom:8px}
.sub{font-size:15px;color:#7a6a5a;margin-bottom:28px;line-height:1.5;font-family:'DM Sans',sans-serif}
.src{display:flex;align-items:center;gap:12px;padding:14px 16px;background:#ede8df;border:2px solid transparent;border-radius:12px;cursor:pointer;width:100%;margin-bottom:10px;text-align:left;transition:all .15s}
.src.on{background:#fff;border-color:#1a1410}
.src .flag{font-size:22px}
.src .name{flex:1;font-size:16px;font-family:'Crimson Pro',serif}
.src.on .name{font-weight:700}
.src .ck{width:22px;height:22px;border-radius:50%;border:2px solid #c4b9a8;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:13px;color:#f5f0e8}
.src.on .ck{background:#1a1410;border-color:#1a1410}
.btn{width:100%;padding:16px;background:#c0392b;color:#fff;border:none;border-radius:12px;font-size:16px;font-family:inherit;font-weight:600;cursor:pointer;margin-top:8px}
.btn:disabled{background:#ccc;cursor:default}
.err{background:#fff0f0;border:1px solid #ffcdd2;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:13px;color:#b71c1c;font-family:'DM Sans',sans-serif;display:none}
.prog{display:flex;gap:3px;margin-bottom:16px}
.pd{flex:1;height:3px;border-radius:2px;background:#d4c8b8}
.pd.on{background:#c0392b}
.card-wrap{position:relative;margin-bottom:14px}
.sl{position:absolute;top:14px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;font-family:'DM Sans',sans-serif;opacity:0;transition:opacity .15s;z-index:2;pointer-events:none}
.sl.know{right:14px;color:#27ae60}
.sl.rev{left:14px;color:#c0392b}
.card{background:#fff;border-radius:16px;padding:20px;box-shadow:0 4px 24px rgba(0,0,0,.08);cursor:grab;user-select:none;border:2px solid transparent;touch-action:pan-y}
.csrc{font-size:12px;color:#9a8a7a;margin-bottom:10px;font-family:'DM Sans',sans-serif}
.ctitle{font-size:13px;color:#9a8a7a;margin-bottom:10px;font-style:italic;line-height:1.4;font-family:'DM Sans',sans-serif}
.ctext{font-size:18px;line-height:1.65}
.w{cursor:pointer;border-radius:3px;display:inline}
.w.s{background:#ffeaa0;padding:1px 2px}
.svbtn{width:100%;padding:11px;background:#ede8df;color:#9a8a7a;border:none;border-radius:10px;font-size:13px;font-family:'DM Sans',sans-serif;font-weight:600;letter-spacing:.3px;text-transform:uppercase;margin-bottom:10px;cursor:default;transition:all .2s}
.svbtn.on{background:#1a1410;color:#f5f0e8;cursor:pointer}
.ldb{background:#fff;border-radius:14px;padding:22px;text-align:center;color:#9a8a7a;font-size:14px;font-family:'DM Sans',sans-serif;box-shadow:0 2px 12px rgba(0,0,0,.05);margin-bottom:12px}
.ab{background:#fff;border-radius:14px;padding:18px;margin-bottom:12px;box-shadow:0 2px 12px rgba(0,0,0,.05)}
.tr{font-size:16px;line-height:1.6;color:#3a2a1a;margin-bottom:12px;font-style:italic}
.rt{display:inline-block;padding:3px 10px;background:#f5f0e8;border-radius:12px;font-size:11px;color:#7a6a5a;font-family:'DM Sans',sans-serif;letter-spacing:.5px;text-transform:uppercase;margin-bottom:14px}
.hl{border-left:3px solid #c0392b;padding-left:10px;margin-bottom:10px}
.hp{font-size:15px;font-weight:700}
.hm{font-size:14px;color:#4a3a2a;margin:2px 0}
.hn{font-size:13px;color:#9a8a7a;font-family:'DM Sans',sans-serif}
.tip{font-size:14px;color:#6a5a4a;line-height:1.6;font-family:'DM Sans',sans-serif;border-top:1px solid #ede8df;padding-top:10px}
.acts{display:flex;gap:10px}
.ar{flex:1;padding:13px;border:2px solid #c0392b;border-radius:10px;cursor:pointer;font-size:13px;font-family:'DM Sans',sans-serif;font-weight:600;letter-spacing:.3px;text-transform:uppercase;background:#fff;color:#c0392b}
.ak{flex:1;padding:13px;border:none;border-radius:10px;cursor:pointer;font-size:13px;font-family:'DM Sans',sans-serif;font-weight:600;letter-spacing:.3px;text-transform:uppercase;background:#27ae60;color:#fff}
.fwrap{perspective:1000px;width:100%;height:190px;cursor:pointer;margin-bottom:14px}
.finner{position:relative;width:100%;height:100%;transform-style:preserve-3d;transition:transform .5s}
.finner.flip{transform:rotateY(180deg)}
.fface{position:absolute;inset:0;backface-visibility:hidden;border-radius:16px;display:flex;align-items:center;justify-content:center;padding:24px;flex-direction:column;gap:8px;box-shadow:0 4px 20px rgba(0,0,0,.08)}
.ff{background:#fff;color:#1a1410}
.fb{background:#1a1410;color:#f5f0e8;transform:rotateY(180deg)}
.fnav{display:flex;gap:10px;margin-bottom:28px;align-items:center}
.fc{display:flex;align-items:center;justify-content:center;color:#9a8a7a;font-size:13px;min-width:60px;font-family:'DM Sans',sans-serif}
.vc{background:#fff;border-radius:12px;padding:14px;margin-bottom:10px;box-shadow:0 2px 8px rgba(0,0,0,.05)}
.vw{font-size:19px;font-weight:700}
.vx{font-size:13px;color:#9a8a7a;border-left:2px solid #ede8df;padding-left:8px;margin:4px 0;font-family:'DM Sans',sans-serif}
.vm{font-size:12px;color:#bbb;font-family:'DM Sans',sans-serif}
.vd{float:right;background:none;border:none;cursor:pointer;color:#ccc;font-size:16px}
.toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:#1a1410;color:#f5f0e8;padding:10px 22px;border-radius:20px;font-size:13px;font-family:'DM Sans',sans-serif;z-index:100;opacity:0;pointer-events:none;transition:opacity .3s;white-space:nowrap}
.toast.show{opacity:1}
.done{justify-content:center;text-align:center;padding:32px}
.retbtn{background:#c0392b;color:#fff;border:none;border-radius:6px;padding:7px 14px;cursor:pointer;font-size:13px;font-family:'DM Sans',sans-serif;font-weight:600;margin-top:8px}
.statusline{font-size:12px;color:#9a8a7a;margin:0 0 14px;font-family:'DM Sans',sans-serif}
.home-hero{padding-top:28px;margin-bottom:36px}
.home-logo{font-size:48px;font-weight:700;letter-spacing:-2px;line-height:1;margin-bottom:12px}
.home-logo em{color:#c0392b;font-style:normal}
.home-tagline{font-size:16px;color:#7a6a5a;font-family:'DM Sans',sans-serif;line-height:1.5;max-width:280px}
.hnav{display:flex;flex-direction:column;gap:10px;margin-bottom:16px}
.hnav-card{display:flex;align-items:center;gap:16px;padding:20px 20px;background:#fff;border-radius:16px;cursor:pointer;border:2px solid transparent;box-shadow:0 2px 12px rgba(0,0,0,.05);width:100%;text-align:left;transition:border-color .15s,transform .1s}
.hnav-card:active{border-color:#d4c8b8;transform:scale(.99)}
.hnav-card.primary{background:#1a1410;border-color:#1a1410}
.hnav-card.primary:active{border-color:#333}
.hnav-icon{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:20px;background:#f5f0e8}
.hnav-card.primary .hnav-icon{background:rgba(255,255,255,.08)}
.hnav-text{flex:1;min-width:0}
.hnav-title{font-size:21px;font-weight:700;font-family:'Crimson Pro',serif;letter-spacing:-.3px;color:#1a1410;line-height:1.1;margin-bottom:3px}
.hnav-card.primary .hnav-title{color:#f5f0e8}
.hnav-desc{font-size:13px;color:#9a8a7a;font-family:'DM Sans',sans-serif;line-height:1.4}
.hnav-card.primary .hnav-desc{color:#6a5a4a}
.hnav-arrow{font-size:18px;color:#c4b9a8;flex-shrink:0;font-family:'DM Sans',sans-serif}
.hnav-card.primary .hnav-arrow{color:#4a3a2a}
.hnav-settings{display:flex;align-items:center;justify-content:center;gap:8px;background:none;border:none;cursor:pointer;font-size:14px;color:#9a8a7a;font-family:'DM Sans',sans-serif;padding:10px;width:100%;border-radius:10px;transition:background .15s}
.hnav-settings:active{background:#ede8df}
.ham{background:none;border:none;cursor:pointer;padding:4px 0;display:flex;flex-direction:column;gap:5px}
.ham span{display:block;width:22px;height:2px;background:#1a1410;border-radius:2px;transition:all .2s}
#menuOverlay{position:fixed;inset:0;background:#f5f0e8;z-index:200;display:none;flex-direction:column;align-items:center;opacity:0;transition:opacity .2s}
#menuOverlay.open{display:flex;opacity:1;pointer-events:all}
.menu-head{width:100%;max-width:480px;display:flex;justify-content:space-between;align-items:center;padding:18px 20px 0;flex-shrink:0}
.menu-links{width:100%;max-width:480px;padding:32px 20px 20px;flex:1}
.menu-link{display:block;width:100%;font-size:32px;font-weight:700;font-family:'Crimson Pro',serif;padding:14px 0;border:none;background:none;cursor:pointer;text-align:left;color:#1a1410;letter-spacing:-.5px;border-bottom:1px solid #ede8df}
.menu-link.small{font-size:18px;color:#9a8a7a;font-weight:400;border-bottom:none;padding-top:20px}
.art-card{background:#fff;border-radius:14px;padding:18px;margin-bottom:12px;cursor:pointer;box-shadow:0 2px 12px rgba(0,0,0,.05);border:2px solid transparent;transition:border-color .15s}
.art-card:active{border-color:#1a1410}
.art-src{font-size:12px;color:#9a8a7a;margin-bottom:8px;font-family:'DM Sans',sans-serif;display:flex;align-items:center;gap:6px}
.art-title{font-size:18px;font-weight:700;line-height:1.3}
.sent-prog{font-size:12px;color:#9a8a7a;margin-bottom:14px;font-family:'DM Sans',sans-serif}
</style>
</head>
<body>
<!-- Hamburger menu overlay -->
<div id="menuOverlay">
  <div class="menu-head">
    <div class="logo" onclick="closeMenu();showScreen('home')">habla<em>.</em></div>
    <button class="ham" onclick="closeMenu()"><span></span><span></span><span></span></button>
  </div>
  <div class="menu-links">
    <button type="button" class="menu-link" id="menu-snippets-btn">Snippets</button>
    <button type="button" class="menu-link" id="menu-vocab-btn">Vocab</button>
    <button type="button" class="menu-link" id="menu-read-btn">Read</button>
    <button type="button" class="menu-link small" id="menu-sources-btn">&#9881; Sources</button>
  </div>
</div>
<!-- Home screen — default landing -->
<div id="S-home" class="screen active">
  <div class="body">
    <div class="home-hero">
      <div class="home-logo">habla<em>.</em></div>
      <div class="home-tagline">Learn Spanish through real news, one phrase at a time.</div>
    </div>
    <div class="hnav">
      <button type="button" class="hnav-card" id="home-snippets-btn">
        <div class="hnav-icon">⚡</div>
        <div class="hnav-text">
          <div class="hnav-title">Snippets</div>
          <div class="hnav-desc">Study today's headlines as flashcards</div>
        </div>
        <div class="hnav-arrow">→</div>
      </button>
      <button type="button" class="hnav-card" id="home-read-btn">
        <div class="hnav-icon">📖</div>
        <div class="hnav-text">
          <div class="hnav-title">Read</div>
          <div class="hnav-desc">Browse full articles</div>
        </div>
        <div class="hnav-arrow">→</div>
      </button>
      <button type="button" class="hnav-card" id="home-vocab-btn">
        <div class="hnav-icon">🗂</div>
        <div class="hnav-text">
          <div class="hnav-title">Vocab</div>
          <div class="hnav-desc">Review your saved words</div>
        </div>
        <div class="hnav-arrow">→</div>
      </button>
    </div>
    <button type="button" class="hnav-settings" id="home-sources-btn">⚙&ensp;Sources &amp; Settings</button>
  </div>
</div>
<!-- Snippets (flashcard study) -->
<div id="S-snippets" class="screen">
  <div class="topbar">
    <div class="logo" onclick="showScreen('home')">habla<em>.</em></div>
    <button class="ham" onclick="openMenu()"><span></span><span></span><span></span></button>
  </div>
  <div class="body">
    <div class="err" id="fetchErr"></div>
    <div class="statusline" id="statusLine"></div>
    <div class="prog" id="prog"></div>
    <div class="card-wrap">
      <div class="sl know" id="slKnow">&#10003; Got it</div>
      <div class="sl rev" id="slRev">&#8629; Again</div>
      <div class="card" id="card">
        <div class="csrc" id="csrc"></div>
        <div class="ctitle" id="ctitle"></div>
        <div class="ctext" id="ctext"></div>
      </div>
    </div>
    <button class="svbtn" id="svbtn" onclick="saveVocab()">Tap words above to save vocab</button>
    <div id="aArea"></div>
    <div class="acts">
      <button class="ar" onclick="advance('rev')">&#8629; Again</button>
      <button class="ak" onclick="advance('know')">&#10003; Got it</button>
    </div>
  </div>
</div>
<!-- Done screen -->
<div id="S-done" class="screen done">
  <div style="font-size:48px;margin-bottom:12px">&#127881;</div>
  <div style="font-size:28px;font-weight:700">All done!</div>
  <div id="doneSub" style="font-size:15px;color:#9a8a7a;margin:8px 0 24px;font-family:'DM Sans',sans-serif"></div>
  <button class="btn" style="width:auto;padding:12px 28px;margin-top:0" onclick="loadArticles()">More articles &rarr;</button>
  <button class="ar" id="doneVocab" style="width:auto;padding:12px 28px;margin-top:10px;display:none" onclick="showVocab()"></button>
</div>
<!-- Vocab screen -->
<div id="S-vocab" class="screen">
  <div class="topbar">
    <div class="logo" onclick="showScreen('home')">habla<em>.</em></div>
    <button class="ham" onclick="openMenu()"><span></span><span></span><span></span></button>
  </div>
  <div class="body">
    <div class="lbl">Saved vocab</div>
    <div id="vcCount" style="font-size:28px;font-weight:700;margin-bottom:20px"></div>
    <div id="vcFlash"></div>
    <div class="lbl" id="vcListLbl" style="display:none">All words</div>
    <div id="vcList"></div>
  </div>
</div>
<!-- Read screen -->
<div id="S-read" class="screen">
  <div class="topbar">
    <div class="logo" onclick="showScreen('home')">habla<em>.</em></div>
    <button class="ham" onclick="openMenu()"><span></span><span></span><span></span></button>
  </div>
  <div class="body">
    <div id="readArea"></div>
  </div>
</div>
<!-- Sources settings screen -->
<div id="S-sources" class="screen">
  <div class="topbar">
    <div class="logo" onclick="showScreen('home')">habla<em>.</em></div>
    <button class="ham" onclick="openMenu()"><span></span><span></span><span></span></button>
  </div>
  <div class="body">
    <div class="lbl">Settings</div>
    <h1 style="font-size:28px;margin-bottom:8px">Sources</h1>
    <p class="sub">Choose which sources Snippets and Read pull from.</p>
    <div id="srcList"></div>
  </div>
</div>
<div class="toast" id="toast">Saved to vocab!</div>
<script>
var SRCS = {
  bbc:     { name: "BBC Mundo",      logo: "https://www.google.com/s2/favicons?domain=bbc.com&sz=64" },
  elpais:  { name: "El País",        logo: "https://www.google.com/s2/favicons?domain=elpais.com&sz=64" },
  elmundo: { name: "El Mundo",       logo: "https://www.google.com/s2/favicons?domain=elmundo.es&sz=64" },
  infobae: { name: "Infobae",        logo: "https://www.google.com/s2/favicons?domain=infobae.com&sz=64" },
  cnn:     { name: "CNN en Español", logo: "https://www.google.com/s2/favicons?domain=cnnespanol.cnn.com&sz=64" }
};
var cards = [], idx = 0, sel = [], vocab = [], vIdx = 0, vocabCache = {};
var ALL_SRCS = Object.keys({bbc:1,elpais:1,elmundo:1,infobae:1,cnn:1});
var selSrc = ALL_SRCS.slice();
var dragData = null;
var nextCursor = null;
var loadingMore = false;
var exhausted = false;
var activeRequestId = 0;
var readArticles = [], readArticle = null, sentences = [], sentenceIdx = 0, readActiveReqId = 0;
var readSel = [], readDragData = null;
try { selSrc = JSON.parse(localStorage.getItem("hSrc") || JSON.stringify(ALL_SRCS)); } catch(e) {}
try { vocab = JSON.parse(localStorage.getItem("hVocab") || "[]"); } catch(e) {}
function openMenu() { document.getElementById("menuOverlay").classList.add("open"); }
function closeMenu() { document.getElementById("menuOverlay").classList.remove("open"); }
function bindNavButtons() {
  var bindings = [
    ["home-snippets-btn", function() { showScreen("snippets"); }],
    ["home-read-btn", function() { showRead(); }],
    ["home-vocab-btn", function() { showVocab(); }],
    ["home-sources-btn", function() { showScreen("sources"); }],
    ["menu-snippets-btn", function() { closeMenu(); showScreen("snippets"); }],
    ["menu-vocab-btn", function() { closeMenu(); showVocab(); }],
    ["menu-read-btn", function() { closeMenu(); showRead(); }],
    ["menu-sources-btn", function() { closeMenu(); showScreen("sources"); }]
  ];
  bindings.forEach(function(binding) {
    var el = document.getElementById(binding[0]);
    if (el) el.onclick = binding[1];
  });
}
function init() {
  bindNavButtons();
  renderSrcList();
  updateVocabBtns();
  renderVocab();
  loadArticles();
}
function renderSrcList() {
  var list = document.getElementById("srcList");
  list.innerHTML = "";
  Object.keys(SRCS).forEach(function(id) {
    var s = SRCS[id];
    var btn = document.createElement("button");
    btn.className = "src" + (selSrc.indexOf(id) >= 0 ? " on" : "");
    btn.setAttribute("data-id", id);
    var flag = document.createElement("span");
    flag.className = "flag";
    var img = document.createElement("img");
    img.src = s.logo;
    img.width = 28;
    img.height = 28;
    img.style.cssText = "border-radius:4px;display:block";
    flag.appendChild(img);
    var name = document.createElement("span");
    name.className = "name";
    name.textContent = s.name;
    var ck = document.createElement("span");
    ck.className = "ck";
    ck.textContent = selSrc.indexOf(id) >= 0 ? "✓" : "";
    btn.appendChild(flag);
    btn.appendChild(name);
    btn.appendChild(ck);
    btn.onclick = function() { toggleSrc(id, btn, ck, name); };
    list.appendChild(btn);
  });
}
function toggleSrc(id, btn, ck, name) {
  var i = selSrc.indexOf(id);
  if (i >= 0) {
    selSrc.splice(i, 1);
    btn.classList.remove("on");
    ck.textContent = "";
    name.style.fontWeight = "";
  } else {
    selSrc.push(id);
    btn.classList.add("on");
    ck.textContent = "✓";
    name.style.fontWeight = "700";
  }
  try { localStorage.setItem("hSrc", JSON.stringify(selSrc)); } catch(e) {}
}
function showScreen(s) {
  document.querySelectorAll(".screen").forEach(function(el) { el.classList.remove("active"); });
  document.getElementById("S-" + s).classList.add("active");
  closeMenu();
}
function showVocab() {
  showScreen("vocab");
  renderVocab();
}
function updateVocabBtns() {
  var label = vocab.length ? "VOCAB (" + vocab.length + ")" : "VOCAB";
  document.querySelectorAll(".nav button").forEach(function(b) {
    if (b.textContent.indexOf("VOCAB") === 0) b.textContent = label;
  });
}
async function loadArticles(mode) {
  if (!selSrc.length) return;
  var err = document.getElementById("fetchErr");
  var initial = mode !== "more";
  if (initial) {
    if (err) err.style.display = "none";
    cards = [];
    idx = 0;
    nextCursor = null;
    exhausted = false;
  }
  try {
    var qs = "/feeds?sources=" + encodeURIComponent(selSrc.join(",")) + "&batch=12";
    if (!initial && nextCursor) qs += "&cursor=" + encodeURIComponent(nextCursor);
    var r = await fetch(qs);
    var d = await r.json();
    if (!d.ok) throw new Error(d.error || "No articles found");
    var newItems = d.items || [];
    if (!newItems.length && initial) throw new Error("No articles found");
    if (initial) cards = newItems;
    else cards = cards.concat(newItems);
    nextCursor = d.nextCursor || null;
    exhausted = !d.hasMore;
    if (initial && cards.length) {
      renderCard();
      var cur = document.querySelector(".screen.active");
      if (!cur || cur.id !== "S-home") showScreen("snippets");
    } else {
      renderStatus();
      renderProg();
    }
  } catch(e) {
    if (initial && err) {
      err.textContent = "Could not load articles: " + e.message;
      err.style.display = "block";
    }
  }
}
function renderStatus() {
  var el = document.getElementById("statusLine");
  if (!cards.length) {
    el.textContent = "";
    return;
  }
  var remaining = cards.length - idx;
  var moreLabel = exhausted ? "end of current feed pool" : "more loading as you go";
  el.textContent = (idx + 1) + " of " + cards.length + " loaded · " + remaining + " remaining · " + moreLabel;
}
function bindCardGestures() {
  var card = document.getElementById("card");
  if (!card) return;
  card.onpointerdown = dStart;
  card.onpointermove = dMove;
  card.onpointerup = dEnd;
  card.onpointercancel = dEnd;
}
function renderCard() {
  if (!cards[idx]) return;
  var c = cards[idx];
  sel = [];
  activeRequestId++;
  document.getElementById("csrc").textContent = c.flag + "  " + c.source;
  var titleEl = document.getElementById("ctitle");
  titleEl.textContent = c.title || "";
  titleEl.style.display = c.title ? "" : "none";
  var textEl = document.getElementById("ctext");
  textEl.innerHTML = "";
  var tokens = c.content.split(/(\\s+)/);
  tokens.forEach(function(tok, i) {
    if (/\\S/.test(tok)) {
      var sp = document.createElement("span");
      sp.className = "w";
      sp.textContent = tok;
      sp.setAttribute("data-i", i);
      sp.onclick = function(e) {
        e.stopPropagation();
        toggleWord(i, sp);
      };
      textEl.appendChild(sp);
    } else {
      textEl.appendChild(document.createTextNode(tok));
    }
  });
  renderProg();
  renderStatus();
  updateSaveBtn();
  analyzeCard(c, activeRequestId);
  var card = document.getElementById("card");
  card.style.transition = "";
  card.style.transform = "";
  card.style.borderColor = "transparent";
  bindCardGestures();
}
function toggleWord(i, el) {
  var pos = sel.indexOf(i);
  if (pos >= 0) {
    sel.splice(pos, 1);
    el.classList.remove("s");
  } else {
    sel.push(i);
    el.classList.add("s");
  }
  updateSaveBtn();
}
function getPhrases() {
  if (!sel.length || !cards[idx]) return [];
  var tokens = cards[idx].content.split(/(\\s+)/);
  var sorted = sel.slice().sort(function(a,b){ return a - b; });
  var groups = [], g = [sorted[0]];
  for (var i = 1; i < sorted.length; i++) {
    var between = tokens.slice(sorted[i - 1] + 1, sorted[i]).join("");
    if (/^\\s*$/.test(between)) {
      g.push(sorted[i]);
    } else {
      groups.push(g);
      g = [sorted[i]];
    }
  }
  groups.push(g);
  return groups.map(function(gr) {
    return tokens
      .slice(gr[0], gr[gr.length - 1] + 1)
      .join("")
      .replace(/^[.,!?;:"'()¿¡\\s]+|[.,!?;:"'()¿¡\\s]+$/g, "")
      .trim();
  }).filter(Boolean);
}
function updateSaveBtn() {
  var btn = document.getElementById("svbtn");
  var phrases = getPhrases();
  if (phrases.length) {
    btn.className = "svbtn on";
    btn.textContent = "Save: " + phrases.map(function(p){ return '"' + p + '"'; }).join(", ");
  } else {
    btn.className = "svbtn";
    btn.textContent = "Tap words above to save vocab";
  }
}
function saveVocab() {
  var phrases = getPhrases();
  if (!phrases.length || !cards[idx]) return;
  var c = cards[idx];
  phrases.forEach(function(word) {
    var exists = vocab.some(function(v) {
      return v.word.toLowerCase() === word.toLowerCase() && v.context === c.content.slice(0, 120);
    });
    if (!exists) {
      var item = {
        id: Date.now() + Math.random(),
        word: word,
        context: c.content.slice(0, 120),
        source: c.source,
        saved: new Date().toLocaleDateString()
      };
      vocab.unshift(item);
      // Pre-fetch translation in background so vocab card is instant
      (function(it) {
        fetch('/vocab', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ word: it.word, context: it.context })
        })
        .then(function(r) { return r.json(); })
        .then(function(d) { if (d.ok) vocabCache[it.id] = d; })
        .catch(function() {});
      })(item);
    }
  });
  try { localStorage.setItem("hVocab", JSON.stringify(vocab)); } catch(e) {}
  updateVocabBtns();
  sel = [];
  document.querySelectorAll(".w.s").forEach(function(el){ el.classList.remove("s"); });
  updateSaveBtn();
  var t = document.getElementById("toast");
  t.classList.add("show");
  setTimeout(function(){ t.classList.remove("show"); }, 2000);
}
function saveHighlight(btn) {
  var phrase = btn.getAttribute('data-phrase');
  if (!phrase || !cards[idx]) return;
  var c = cards[idx];
  var context = c.content.slice(0, 120);
  var exists = vocab.some(function(v) {
    return v.word.toLowerCase() === phrase.toLowerCase() && v.context === context;
  });
  if (exists) {
    btn.textContent = "✓";
    btn.style.background = "#27ae60";
    btn.disabled = true;
    return;
  }
  var item = {
    id: Date.now() + Math.random(),
    word: phrase,
    context: context,
    source: c.source,
    saved: new Date().toLocaleDateString()
  };
  vocab.unshift(item);
  try { localStorage.setItem("hVocab", JSON.stringify(vocab)); } catch(e) {}
  updateVocabBtns();
  (function(it) {
    fetch('/vocab', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ word: it.word, context: it.context })
    })
    .then(function(r) { return r.json(); })
    .then(function(d) { if (d.ok) vocabCache[it.id] = d; })
    .catch(function() {});
  })(item);
  btn.textContent = "✓";
  btn.style.background = "#27ae60";
  btn.disabled = true;
  var t = document.getElementById("toast");
  t.classList.add("show");
  setTimeout(function(){ t.classList.remove("show"); }, 2000);
}
function renderProg() {
  var el = document.getElementById("prog");
  el.innerHTML = "";
  var n = Math.min(cards.length, 25);
  for (var i = 0; i < n; i++) {
    var d = document.createElement("div");
    d.className = "pd" + (i <= idx ? " on" : "");
    el.appendChild(d);
  }
}
async function analyzeCard(card, requestId) {
  var el = document.getElementById("aArea");
  el.innerHTML = '<div class="ldb">Analyzing...</div>';
  try {
    var r = await fetch("/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: card.content })
    });
    var d = await r.json();
    if (!d.ok) throw new Error(d.error || "Failed");
    if (requestId !== activeRequestId) return;
    var a = d.analysis;
    var html = '<div class="ab">';
    html += '<div class="lbl" style="margin-bottom:6px">English</div>';
    html += '<div class="tr">' + esc(a.translation || "") + '</div>';
    if (a.highlights && a.highlights.length) {
      html += '<div class="lbl" style="margin:14px 0 8px">Vocab Tips</div>';
      (a.highlights).forEach(function(h) {
        html += '<div class="hl" style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">';
        html += '<div style="flex:1"><div class="hp">' + esc(h.phrase) + '</div>';
        html += '<div class="hm">' + esc(h.meaning) + '</div>';
        if (h.note) html += '<div class="hn">' + esc(h.note) + '</div>';
        html += '</div>';
        html += '<button onclick="saveHighlight(this)" data-phrase="' + esc(h.phrase) + '" style="background:#1a1410;color:#f5f0e8;border:none;border-radius:50%;width:26px;height:26px;cursor:pointer;font-size:16px;flex-shrink:0;margin-top:2px;line-height:1">+</button>';
        html += '</div>';
      });
    }
    if (a.tip) {
      html += '<div class="lbl" style="margin:14px 0 6px">&#128161; Extra Tip</div>';
      html += '<div class="tip">' + esc(a.tip) + '</div>';
    }
    html += '</div>';
    el.innerHTML = html;
  } catch(e) {
    if (requestId !== activeRequestId) return;
    el.innerHTML = '<div class="err" style="display:block">' + esc(e.message) + ' <button class="retbtn" onclick="analyzeCard(cards[idx], activeRequestId)">Retry</button></div>';
  }
}
function esc(s) {
  return String(s || "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}
async function maybeLoadMore() {
  if (loadingMore || exhausted || !nextCursor) return;
  if ((cards.length - idx) > 3) return;
  loadingMore = true;
  try {
    await loadArticles("more");
  } catch(e) {
    console.log("load more failed", e);
  }
  loadingMore = false;
}
function advance(dir) {
  var card = document.getElementById("card");
  card.style.transition = "transform 0.35s ease";
  card.style.transform = dir === "know"
    ? "translateX(120%) rotate(15deg)"
    : "translateX(-120%) rotate(-15deg)";
  setTimeout(async function() {
    idx++;
    await maybeLoadMore();
    if (idx < cards.length) {
      renderCard();
    } else if (nextCursor && !loadingMore) {
      try {
        loadingMore = true;
        await loadArticles("more");
      } finally {
        loadingMore = false;
      }
      if (idx < cards.length) {
        renderCard();
        return;
      }
      showScreen("done");
      document.getElementById("doneSub").textContent =
        "You went through all " + cards.length + " loaded articles.";
    } else {
      showScreen("done");
      document.getElementById("doneSub").textContent =
        "You went through all available articles from these feeds.";
    }
    var vb = document.getElementById("doneVocab");
    if (vocab.length) {
      vb.style.display = "";
      vb.textContent = "Review vocab (" + vocab.length + ")";
    }
  }, 350);
}
function dStart(e) {
  if (e.target.closest(".w")) {
    dragData = null;
    return;
  }
  dragData = {
    x: e.clientX,
    y: e.clientY,
    moved: false,
    pointerId: e.pointerId
  };
}
function dMove(e) {
  if (!dragData) return;
  var dx = e.clientX - dragData.x;
  var dy = (e.clientY - dragData.y) * 0.3;
  if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
    dragData.moved = true;
  } else {
    return;
  }
  var card = document.getElementById("card");
  card.style.transition = "none";
  card.style.transform = "translate(" + dx + "px," + dy + "px) rotate(" + (dx * 0.08) + "deg)";
  card.style.borderColor = dx > 60 ? "#27ae60" : dx < -60 ? "#c0392b" : "transparent";
  document.getElementById("slKnow").style.opacity = dx > 60 ? 1 : 0;
  document.getElementById("slRev").style.opacity = dx < -60 ? 1 : 0;
}
function dEnd(e) {
  if (!dragData) return;
  var dx = e.clientX - dragData.x;
  var moved = dragData.moved;
  dragData = null;
  document.getElementById("slKnow").style.opacity = 0;
  document.getElementById("slRev").style.opacity = 0;
  if (!moved) {
    var card = document.getElementById("card");
    card.style.transition = "";
    card.style.transform = "";
    card.style.borderColor = "transparent";
    return;
  }
  if (dx > 80) {
    advance("know");
  } else if (dx < -80) {
    advance("rev");
  } else {
    var card = document.getElementById("card");
    card.style.transition = "transform 0.35s cubic-bezier(0.34,1.56,0.64,1)";
    card.style.transform = "";
    card.style.borderColor = "transparent";
  }
}
function flipVocab(el) {
  var item = vocab[vIdx];
  var inner = el.querySelector('.finner');
  var flippingToBack = !inner.classList.contains('flip');
  inner.classList.toggle('flip');
  if (!flippingToBack) return;
  var backEl = document.getElementById('vcBack');
  if (vocabCache[item.id]) {
    backEl.innerHTML = vocabBackHTML(vocabCache[item.id]);
    return;
  }
  backEl.innerHTML = '<div style="opacity:.6;font-family:DM Sans,sans-serif;font-size:13px">Translating...</div>';
  fetch('/vocab', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ word: item.word, context: item.context })
  })
  .then(function(r) { return r.json(); })
  .then(function(d) {
    if (!d.ok) throw new Error(d.error || 'Failed');
    vocabCache[item.id] = d;
    var el2 = document.getElementById('vcBack');
    if (el2) el2.innerHTML = vocabBackHTML(d);
  })
  .catch(function(e) {
    var el2 = document.getElementById('vcBack');
    if (el2) el2.innerHTML = '<div style="color:#ff9999;font-size:13px;font-family:DM Sans,sans-serif">' + esc(e.message) + '</div>';
  });
}
function vocabBackHTML(d) {
  return '<div style="font-size:22px;font-weight:700;margin-bottom:10px">' + esc(d.translation) + '</div>' +
    '<div style="font-size:13px;line-height:1.6;font-family:DM Sans,sans-serif;text-align:center;opacity:.85">' + esc(d.explanation) + '</div>';
}
function renderVocab() {
  var count = document.getElementById("vcCount");
  var flash = document.getElementById("vcFlash");
  var list = document.getElementById("vcList");
  var lbl = document.getElementById("vcListLbl");
  count.textContent = vocab.length + " words saved";
  if (!vocab.length) {
    flash.innerHTML = '<p style="color:#9a8a7a;text-align:center;padding:40px 0;font-family:DM Sans,sans-serif">No vocab yet.</p>';
    list.innerHTML = "";
    lbl.style.display = "none";
    return;
  }
  if (vIdx >= vocab.length) vIdx = vocab.length - 1;
  var item = vocab[vIdx];
  var cached = vocabCache[item.id];
  flash.innerHTML =
    '<div class="fwrap" style="height:240px" onclick="flipVocab(this)">' +
      '<div class="finner">' +
        '<div class="fface ff" style="align-items:flex-start;justify-content:flex-start">' +
          '<div style="font-size:24px;font-weight:700;margin-bottom:8px">' + esc(item.word) + '</div>' +
          '<div style="font-size:13px;color:#7a6a5a;font-family:DM Sans,sans-serif;font-style:italic;line-height:1.5;overflow:hidden;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical">&ldquo;' + esc(item.context) + '&rdquo;</div>' +
        '</div>' +
        '<div class="fface fb" id="vcBack">' +
          (cached ? vocabBackHTML(cached) : '<div style="opacity:.6;font-family:DM Sans,sans-serif;font-size:13px">Tap to translate</div>') +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="fnav">' +
      '<button class="ar" style="flex:1" onclick="navF(-1)">&#8592;</button>' +
      '<div class="fc">' + (vIdx + 1) + ' / ' + vocab.length + '</div>' +
      '<button class="ak" style="flex:1" onclick="navF(1)">&#8594;</button>' +
    '</div>';
  lbl.style.display = "";
  var html = "";
  vocab.forEach(function(v, i) {
    html += '<div class="vc">' +
      '<button class="vd" onclick="delV(' + i + ')">&#215;</button>' +
      '<div class="vw">' + esc(v.word) + '</div>' +
      '<div class="vx">"' + esc(v.context) + '"</div>' +
      '<div class="vm">' + esc(v.source) + ' &middot; ' + esc(v.saved) + '</div>' +
    '</div>';
  });
  list.innerHTML = html;
}
function navF(d) {
  vIdx = Math.max(0, Math.min(vocab.length - 1, vIdx + d));
  renderVocab();
}
function delV(i) {
  vocab.splice(i, 1);
  if (vIdx >= vocab.length) vIdx = Math.max(0, vocab.length - 1);
  try { localStorage.setItem("hVocab", JSON.stringify(vocab)); } catch(e) {}
  updateVocabBtns();
  renderVocab();
}
// ─── Read ──────────────────────────────────────────────────────────────────────
async function showRead() {
  showScreen("read");
  var el = document.getElementById("readArea");
  el.innerHTML = '<div class="ldb">Loading articles...</div>';
  try {
    var r = await fetch("/feeds?sources=" + encodeURIComponent(selSrc.join(",")) + "&batch=5");
    var d = await r.json();
    if (!d.ok || !d.items.length) throw new Error("No articles found");
    readArticles = d.items;
    renderReadList();
  } catch(e) {
    el.innerHTML = '<div class="err" style="display:block">' + esc(e.message) + '</div>';
  }
}
function renderReadList() {
  var el = document.getElementById("readArea");
  var html = '<div class="lbl" style="margin-bottom:14px">Choose an article</div>';
  readArticles.forEach(function(a, i) {
    var srcObj = SRCS[a.sourceId] || {};
    html += '<div class="art-card" onclick="openArticle(' + i + ')">';
    html += '<div class="art-src">';
    if (srcObj.logo) html += '<img src="' + esc(srcObj.logo) + '" width="16" height="16" style="border-radius:2px">';
    html += esc(a.source) + '</div>';
    html += '<div class="art-title">' + esc(a.title || a.content.slice(0, 80)) + '</div>';
    html += '</div>';
  });
  el.innerHTML = html;
}
function isNoiseParagraph(text) {
  // Filter out social sharing buttons, photo credits, metadata, and JS fragments
  // NOTE: inside a template literal, regex backslashes must be doubled (\\s not \s)
  return (
    /compartir en (whatsapp|facebook|twitter|linkedin|bluesky)/i.test(text) ||
    /^(foto|vídeo|video|photo|image|crédito|credit)\\s*:/i.test(text) ||
    /copiar enlace/i.test(text) ||
    /ir a los comentarios/i.test(text) ||
    [/whatsapp/i, /facebook/i, /twitter/i, /linkedin/i, /bluesky/i].filter(function(p) { return p.test(text); }).length >= 2 ||
    /"\\w+"\\s*:\\s*(?:"[^"]*"|true|false|\\d+)\\s*,\\s*"\\w+"\\s*:/.test(text) ||
    /\\}\\s*\\)\\s*;/.test(text)
  );
}
function splitSentences(text) {
  // Split on sentence-ending punctuation
  var parts = text.match(/[^.!?]+[.!?]+/g);
  // Fall back to pipe separators (used by some RSS feeds)
  if (!parts || parts.length < 2) {
    parts = text.split(/\s*\|\s*/).filter(function(s) { return s.length > 10; });
  }
  // Fall back to comma/semicolon clauses
  if (!parts || parts.length < 2) {
    parts = text.split(/[,;]\s+/).filter(function(s) { return s.length > 15; });
  }
  if (!parts || parts.length < 2) parts = [text];
  return parts.map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 10 && !isNoiseParagraph(s); });
}
function openArticle(i) {
  readArticle = readArticles[i];
  sentenceIdx = 0;
  sentences = [];
  // Show loading state
  var el = document.getElementById("readArea");
  el.innerHTML = '<div class="ldb" style="margin-top:40px">Loading article...</div>';
  // Try to fetch full article text
  var link = readArticle.link || readArticle.id || "";
  if (link && link.startsWith("http")) {
    fetch("/article?url=" + encodeURIComponent(link))
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.ok && d.text && d.text.length > 100) {
          sentences = splitSentences(d.text);
        } else {
          sentences = splitSentences(readArticle.content);
        }
        renderSentence();
      })
      .catch(function() {
        sentences = splitSentences(readArticle.content);
        renderSentence();
      });
  } else {
    sentences = splitSentences(readArticle.content);
    renderSentence();
  }
}
function toggleReadWord(i, el) {
  var pos = readSel.indexOf(i);
  if (pos >= 0) { readSel.splice(pos, 1); el.classList.remove("s"); }
  else { readSel.push(i); el.classList.add("s"); }
  updateReadSaveBtn();
}
function currentSent() {
  if (sentenceIdx === 1) return readArticle ? (readArticle.title || "") : "";
  if (sentenceIdx >= 2) return sentences[sentenceIdx - 2] || "";
  return "";
}
function getReadPhrases() {
  var sent = currentSent();
  if (!readSel.length || !sent) return [];
  var tokens = sent.split(/(\\s+)/);
  var sorted = readSel.slice().sort(function(a,b){ return a - b; });
  var groups = [], g = [sorted[0]];
  for (var i = 1; i < sorted.length; i++) {
    var between = tokens.slice(sorted[i-1]+1, sorted[i]).join("");
    if (/^\\s*$/.test(between)) { g.push(sorted[i]); }
    else { groups.push(g); g = [sorted[i]]; }
  }
  groups.push(g);
  return groups.map(function(gr) {
    return tokens.slice(gr[0], gr[gr.length-1]+1).join("")
      .replace(/^[.,!?;:"'()¿¡\\s]+|[.,!?;:"'()¿¡\\s]+$/g, "").trim();
  }).filter(Boolean);
}
function updateReadSaveBtn() {
  var btn = document.getElementById("rSvbtn");
  if (!btn) return;
  var phrases = getReadPhrases();
  if (phrases.length) {
    btn.className = "svbtn on";
    btn.textContent = "Save: " + phrases.map(function(p){ return '"' + p + '"'; }).join(", ");
  } else {
    btn.className = "svbtn";
    btn.textContent = "Tap words above to save vocab";
  }
}
function saveReadVocab() {
  var phrases = getReadPhrases();
  if (!phrases.length || !readArticle) return;
  var context = currentSent().slice(0, 120);
  phrases.forEach(function(word) {
    var exists = vocab.some(function(v) { return v.word.toLowerCase() === word.toLowerCase() && v.context === context; });
    if (!exists) {
      var item = { id: Date.now() + Math.random(), word: word, context: context, source: readArticle.source, saved: new Date().toLocaleDateString() };
      vocab.unshift(item);
      (function(it) {
        fetch('/vocab', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ word: it.word, context: it.context }) })
          .then(function(r) { return r.json(); })
          .then(function(d) { if (d.ok) vocabCache[it.id] = d; })
          .catch(function() {});
      })(item);
    }
  });
  try { localStorage.setItem("hVocab", JSON.stringify(vocab)); } catch(e) {}
  updateVocabBtns();
  readSel = [];
  document.querySelectorAll("#rCard .w.s").forEach(function(el){ el.classList.remove("s"); });
  updateReadSaveBtn();
  var t = document.getElementById("toast");
  t.classList.add("show");
  setTimeout(function(){ t.classList.remove("show"); }, 2000);
}
function bindReadGestures() {
  var card = document.getElementById("rCard");
  if (!card) return;
  card.onpointerdown = rDStart;
  card.onpointermove = rDMove;
  card.onpointerup = rDEnd;
  card.onpointercancel = rDEnd;
}
function rDStart(e) {
  if (e.target.closest(".w")) { readDragData = null; return; }
  readDragData = { x: e.clientX, y: e.clientY, moved: false };
}
function rDMove(e) {
  if (!readDragData) return;
  var dx = e.clientX - readDragData.x;
  var dy = (e.clientY - readDragData.y) * 0.3;
  if (Math.abs(dx) > 8 || Math.abs(dy) > 8) readDragData.moved = true;
  else return;
  var card = document.getElementById("rCard");
  card.style.transition = "none";
  card.style.transform = "translate(" + dx + "px," + dy + "px) rotate(" + (dx * 0.08) + "deg)";
  card.style.borderColor = dx > 60 ? "#27ae60" : dx < -60 ? "#c0392b" : "transparent";
}
function rDEnd(e) {
  if (!readDragData) return;
  var dx = e.clientX - readDragData.x;
  var moved = readDragData.moved;
  readDragData = null;
  var card = document.getElementById("rCard");
  if (!moved) { card.style.transition = ""; card.style.transform = ""; card.style.borderColor = "transparent"; return; }
  if (dx > 80 && sentenceIdx < sentences.length + 1) {
    card.style.transition = "transform 0.3s ease, opacity 0.3s ease";
    card.style.transform = "translateX(120%) rotate(20deg)";
    setTimeout(function() { sentenceIdx++; renderSentence(); }, 280);
  } else if (dx < -80 && sentenceIdx > 0) {
    card.style.transition = "transform 0.3s ease, opacity 0.3s ease";
    card.style.transform = "translateX(-120%) rotate(-20deg)";
    setTimeout(function() { sentenceIdx--; renderSentence(); }, 280);
  } else {
    card.style.transition = "transform 0.35s cubic-bezier(0.34,1.56,0.64,1)";
    card.style.transform = "";
    card.style.borderColor = "transparent";
  }
}
function renderSentence() {
  if (!sentences.length) return;
  readSel = [];
  var el = document.getElementById("readArea");
  var totalCards = sentences.length + 2; // card 0=source, 1=headline, 2+=sentences
  readActiveReqId++;
  var reqId = readActiveReqId;
  // Progress label
  var progLabel;
  if (sentenceIdx === 0) progLabel = esc(readArticle.source) + ' &middot; Intro';
  else if (sentenceIdx === 1) progLabel = esc(readArticle.source) + ' &middot; Headline';
  else progLabel = esc(readArticle.source) + ' &middot; Sentence ' + (sentenceIdx - 1) + ' of ' + sentences.length;
  var html = '<div class="sent-prog">' + progLabel + '</div>';
  html += '<div id="rCard" class="card" style="margin-bottom:6px">';
  html += '<div class="csrc">' + esc(readArticle.flag || "") + '  ' + esc(readArticle.source) + '</div>';
  if (sentenceIdx === 0) {
    // Source intro card — just the source banner, no body text
    html += '</div>';
    html += '<button id="rSvbtn" class="svbtn" style="visibility:hidden">placeholder</button>';
    html += '<div id="rArea"></div>';
  } else {
    var sent = currentSent();
    if (sentenceIdx === 1) {
      html += '<div class="ctitle">Headline</div>';
    } else {
      var contextLine = sentenceIdx === 2 ? readArticle.title : sentences[sentenceIdx - 3];
      if (contextLine) html += '<div class="ctitle">' + esc(contextLine) + '</div>';
    }
    html += '<div id="rText" style="font-size:18px;line-height:1.65"></div>';
    html += '</div>';
    html += '<button id="rSvbtn" class="svbtn" onclick="saveReadVocab()">Tap words above to save vocab</button>';
    html += '<div id="rArea"><div class="ldb">Analyzing...</div></div>';
  }
  html += '<div class="acts" style="margin-top:10px">';
  html += '<button class="ar" onclick="renderReadList()" style="flex:0;padding:13px 18px">&#8592; Articles</button>';
  if (sentenceIdx > 0) html += '<button class="ar" onclick="sentenceIdx--;renderSentence()">&#8592; Prev</button>';
  if (sentenceIdx < totalCards - 1) html += '<button class="ak" onclick="sentenceIdx++;renderSentence()">Next &#8594;</button>';
  else html += '<button class="ak" onclick="renderReadList()">Done &#10003;</button>';
  html += '</div>';
  el.innerHTML = html;
  if (sentenceIdx >= 1) {
    // Populate word spans for headline and sentence cards
    var sent = currentSent();
    var textEl = document.getElementById("rText");
    var tokens = sent.split(/(\\s+)/);
    tokens.forEach(function(tok, i) {
      if (/\\S/.test(tok)) {
        var sp = document.createElement("span");
        sp.className = "w";
        sp.textContent = tok;
        sp.setAttribute("data-i", i);
        sp.onclick = function(e) { e.stopPropagation(); toggleReadWord(i, sp); };
        textEl.appendChild(sp);
      } else {
        textEl.appendChild(document.createTextNode(tok));
      }
    });
    fetch("/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ content: sent }) })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (reqId !== readActiveReqId) return;
        if (!d.ok) throw new Error(d.error || "Failed");
        var a = d.analysis;
        var ahtml = '<div class="ab">';
        ahtml += '<div class="lbl" style="margin-bottom:6px">English</div>';
        ahtml += '<div class="tr">' + esc(a.translation || "") + '</div>';
        if (a.highlights && a.highlights.length) {
          ahtml += '<div class="lbl" style="margin:14px 0 8px">Vocab Tips</div>';
          a.highlights.forEach(function(h) {
            ahtml += '<div class="hl" style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">';
            ahtml += '<div style="flex:1"><div class="hp">' + esc(h.phrase) + '</div>';
            ahtml += '<div class="hm">' + esc(h.meaning) + '</div>';
            if (h.note) ahtml += '<div class="hn">' + esc(h.note) + '</div>';
            ahtml += '</div>';
            ahtml += '<button onclick="saveReadHighlight(this)" data-phrase="' + esc(h.phrase) + '" style="background:#1a1410;color:#f5f0e8;border:none;border-radius:50%;width:26px;height:26px;cursor:pointer;font-size:16px;flex-shrink:0;margin-top:2px;line-height:1">+</button>';
            ahtml += '</div>';
          });
        }
        if (a.tip) {
          ahtml += '<div class="lbl" style="margin:14px 0 6px">&#128161; Extra Tip</div>';
          ahtml += '<div class="tip">' + esc(a.tip) + '</div>';
        }
        ahtml += '</div>';
        var rArea = document.getElementById("rArea");
        if (rArea) rArea.innerHTML = ahtml;
      })
      .catch(function(e) {
        var rArea = document.getElementById("rArea");
        if (rArea && reqId === readActiveReqId) rArea.innerHTML = '<div class="err" style="display:block">' + esc(e.message) + '</div>';
      });
  }
  bindReadGestures();
}
function saveReadHighlight(btn) {
  var phrase = btn.getAttribute('data-phrase');
  var article = readArticle;
  if (!phrase || !article) return;
  var context = article.content.slice(0, 120);
  var exists = vocab.some(function(v) { return v.word.toLowerCase() === phrase.toLowerCase() && v.context === context; });
  if (exists) { btn.textContent = "✓"; btn.style.background = "#27ae60"; btn.disabled = true; return; }
  var item = { id: Date.now() + Math.random(), word: phrase, context: context, source: article.source, saved: new Date().toLocaleDateString() };
  vocab.unshift(item);
  try { localStorage.setItem("hVocab", JSON.stringify(vocab)); } catch(e) {}
  updateVocabBtns();
  (function(it) {
    fetch('/vocab', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ word: it.word, context: it.context }) })
      .then(function(r) { return r.json(); })
      .then(function(d) { if (d.ok) vocabCache[it.id] = d; })
      .catch(function() {});
  })(item);
  btn.textContent = "✓"; btn.style.background = "#27ae60"; btn.disabled = true;
  var t = document.getElementById("toast");
  t.classList.add("show");
  setTimeout(function(){ t.classList.remove("show"); }, 2000);
}
init();
</script>
</body>
</html>`;
}
// ─── Worker entry point ───────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/feeds") {
      const sources = (url.searchParams.get("sources") || DEFAULT_SOURCES.join(","))
        .split(",")
        .map(function(s) { return s.trim(); })
        .filter(Boolean);
      const cursor = url.searchParams.get("cursor") || "";
      const batch = Math.min(
        Math.max(parseInt(url.searchParams.get("batch") || String(DEFAULT_BATCH_SIZE), 10), 1),
        MAX_BATCH_SIZE
      );
      try {
        const page = await getFeedsPage(sources, cursor, batch);
        return Response.json({ ok: true, ...page });
      } catch (e) {
        return Response.json({ ok: false, error: e.message }, { status: 500 });
      }
    }
    if (url.pathname === "/analyze" && request.method === "POST") {
      try {
        const body = await request.json();
        const content = String(body.content || "").trim();
        if (!content) {
          return Response.json({ ok: false, error: "Missing content" }, { status: 400 });
        }
        const analysis = await analyzeContent(
          content,
          env.ANTHROPIC_API_KEY,
          env.ANTHROPIC_MODEL
        );
        return Response.json({ ok: true, analysis });
      } catch (e) {
        return Response.json({ ok: false, error: e.message }, { status: 500 });
      }
    }
    if (url.pathname === "/vocab" && request.method === "POST") {
      try {
        const body = await request.json();
        const word = String(body.word || "").trim();
        const context = String(body.context || "").trim();
        if (!word) return Response.json({ ok: false, error: "Missing word" }, { status: 400 });
        const result = await lookupVocab(word, context, env.ANTHROPIC_API_KEY);
        return Response.json({ ok: true, ...result });
      } catch (e) {
        return Response.json({ ok: false, error: e.message }, { status: 500 });
      }
    }
    if (url.pathname === "/article") {
      try {
        const articleUrl = validateArticleUrl(url.searchParams.get("url") || "");
        if (!articleUrl) {
          return Response.json({ ok: false, error: "Unsupported article url" }, { status: 400 });
        }
        const r = await fetch(articleUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (!r.ok) return Response.json({ ok: false, error: "Fetch failed" }, { status: 502 });
        let html = await r.text();
        // Remove non-content sections before extracting paragraphs
        html = html
          .replace(/<script[\s\S]*?<\/script>/gi, " ")
          .replace(/<style[\s\S]*?<\/style>/gi, " ")
          .replace(/<figcaption[\s\S]*?<\/figcaption>/gi, " ")
          .replace(/<figure[\s\S]*?<\/figure>/gi, " ")
          .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
          .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
          .replace(/<header[\s\S]*?<\/header>/gi, " ")
          .replace(/<footer[\s\S]*?<\/footer>/gi, " ");
        // Prefer content inside <article> tag if present
        const articleMatch = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
        const searchHtml = articleMatch ? articleMatch[1] : html;
        const paras = [];
        const rx = /<p[^>]*>([\s\S]*?)<\/p>/gi;
        let m;
        while ((m = rx.exec(searchHtml)) !== null) {
          const text = stripHtml(m[1]);
          if (text.length > 40 && !isNoiseParagraph(text)) paras.push(text);
        }
        const text = paras.slice(0, 40).join(" ");
        if (!text) return Response.json({ ok: false, error: "No content" });
        return Response.json({ ok: true, text });
      } catch (e) {
        return Response.json({ ok: false, error: e.message }, { status: 500 });
      }
    }
    return new Response(getHTML(), {
      headers: { "content-type": "text/html;charset=UTF-8" }
    });
  }
};
