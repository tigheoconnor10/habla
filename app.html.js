// Returns the full HTML for the habla frontend app.
// This is a single-page app that talks to the Worker API endpoints.
// Edit the HTML/CSS/JS here to change the frontend.

export function getHTML() {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="theme-color" content="#f5f0e8">
<title>habla.</title>
<link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,700;1,400&family=DM+Sans:wght@400;600&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  body { background: #f5f0e8; font-family: 'Crimson Pro', Georgia, serif; color: #1a1410; min-height: 100vh; }

  /* Layout */
  .screen { display: none; flex-direction: column; align-items: center; min-height: 100vh; }
  .screen.active { display: flex; }
  .topbar { width: 100%; max-width: 480px; display: flex; justify-content: space-between; align-items: center; padding: 18px 20px 0; }
  .body { width: 100%; max-width: 480px; padding: 20px; flex: 1; }

  /* Type */
  .logo { font-size: 22px; font-weight: 700; cursor: pointer; }
  .logo b { color: #c0392b; font-weight: 700; }
  .lbl { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #9a8a7a; margin-bottom: 10px; font-family: 'DM Sans', sans-serif; }
  h1 { font-size: 36px; font-weight: 700; line-height: 1.1; letter-spacing: -1px; margin-bottom: 8px; }
  .sub { font-size: 15px; color: #7a6a5a; margin-bottom: 28px; line-height: 1.5; font-family: 'DM Sans', sans-serif; }

  /* Nav */
  .nav button { font-family: 'DM Sans', sans-serif; background: none; border: none; cursor: pointer; font-size: 12px; color: #7a6a5a; text-transform: uppercase; letter-spacing: .5px; padding: 4px 6px; }

  /* Source picker */
  .src-btn { display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: #ede8df; border: 2px solid transparent; border-radius: 12px; cursor: pointer; width: 100%; margin-bottom: 10px; text-align: left; transition: all .15s; }
  .src-btn.on { background: #fff; border-color: #1a1410; }
  .src-btn .src-name { flex: 1; font-size: 16px; font-family: 'Crimson Pro', serif; }
  .src-btn.on .src-name { font-weight: 700; }
  .src-btn .checkmark { width: 22px; height: 22px; border-radius: 50%; border: 2px solid #c4b9a8; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 13px; color: transparent; }
  .src-btn.on .checkmark { background: #1a1410; border-color: #1a1410; color: #fff; }

  /* Buttons */
  .btn-primary { width: 100%; padding: 16px; background: #c0392b; color: #fff; border: none; border-radius: 12px; font-size: 16px; font-family: inherit; font-weight: 600; cursor: pointer; margin-top: 8px; }
  .btn-primary:disabled { background: #ccc; cursor: default; }
  .btn-red { flex: 1; padding: 13px; border: 2px solid #c0392b; border-radius: 10px; cursor: pointer; font-size: 13px; font-family: 'DM Sans', sans-serif; font-weight: 600; text-transform: uppercase; background: #fff; color: #c0392b; }
  .btn-green { flex: 1; padding: 13px; border: none; border-radius: 10px; cursor: pointer; font-size: 13px; font-family: 'DM Sans', sans-serif; font-weight: 600; text-transform: uppercase; background: #27ae60; color: #fff; }

  /* Error */
  .error-box { background: #fff0f0; border: 1px solid #ffcdd2; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; font-size: 13px; color: #b71c1c; font-family: 'DM Sans', sans-serif; display: none; }

  /* Progress bar */
  .progress { display: flex; gap: 3px; margin-bottom: 16px; }
  .progress-dot { flex: 1; height: 3px; border-radius: 2px; background: #d4c8b8; }
  .progress-dot.done { background: #c0392b; }

  /* Card */
  .card-wrap { position: relative; margin-bottom: 14px; }
  .swipe-label { position: absolute; font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; font-family: 'DM Sans', sans-serif; opacity: 0; transition: opacity .15s; z-index: 2; pointer-events: none; top: 14px; }
  .swipe-label.know { right: 14px; color: #27ae60; }
  .swipe-label.review { left: 14px; color: #c0392b; }
  .card { background: #fff; border-radius: 16px; padding: 20px; box-shadow: 0 4px 24px rgba(0,0,0,.08); cursor: grab; user-select: none; border: 2px solid transparent; touch-action: none; }
  .card-source { font-size: 12px; color: #9a8a7a; margin-bottom: 10px; font-family: 'DM Sans', sans-serif; }
  .card-title { font-size: 13px; color: #9a8a7a; margin-bottom: 10px; font-style: italic; line-height: 1.4; font-family: 'DM Sans', sans-serif; }
  .card-text { font-size: 18px; line-height: 1.65; }
  .word { cursor: pointer; border-radius: 3px; }
  .word.selected { background: #ffeaa0; padding: 1px 2px; }

  /* Action row */
  .action-row { display: flex; gap: 10px; margin-top: 0; }
  .word-actions { display: flex; gap: 10px; margin-bottom: 10px; }
  .save-btn { flex: 1; padding: 11px; background: #ede8df; color: #9a8a7a; border: none; border-radius: 10px; font-size: 13px; font-family: 'DM Sans', sans-serif; font-weight: 600; letter-spacing: .3px; text-transform: uppercase; cursor: default; transition: all .2s; }
  .save-btn.active { background: #1a1410; color: #f5f0e8; cursor: pointer; }
  .context-btn { flex: 0 0 auto; padding: 11px 18px; background: #ede8df; color: #9a8a7a; border: none; border-radius: 10px; font-size: 13px; font-family: 'DM Sans', sans-serif; font-weight: 600; letter-spacing: .3px; text-transform: uppercase; cursor: default; transition: all .2s; }
  .context-btn.active { background: #c0392b; color: #fff; cursor: pointer; }

  /* Analysis box */
  .loading-box { background: #fff; border-radius: 14px; padding: 22px; text-align: center; color: #9a8a7a; font-size: 14px; font-family: 'DM Sans', sans-serif; box-shadow: 0 2px 12px rgba(0,0,0,.05); margin-bottom: 12px; }
  .analysis-box { background: #fff; border-radius: 14px; padding: 18px; margin-bottom: 12px; box-shadow: 0 2px 12px rgba(0,0,0,.05); }
  .phrase-label { font-size: 13px; color: #9a8a7a; font-family: 'DM Sans', sans-serif; margin-bottom: 6px; }
  .phrase-text { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
  .translation { font-size: 16px; line-height: 1.6; color: #3a2a1a; margin-bottom: 12px; font-style: italic; }
  .explanation { font-size: 14px; color: #6a5a4a; line-height: 1.6; font-family: 'DM Sans', sans-serif; border-top: 1px solid #ede8df; padding-top: 10px; }
  .save-phrase-btn { margin-top: 14px; width: 100%; padding: 10px; background: #1a1410; color: #f5f0e8; border: none; border-radius: 8px; font-size: 13px; font-family: 'DM Sans', sans-serif; font-weight: 600; cursor: pointer; text-transform: uppercase; letter-spacing: .3px; }

  /* Flashcard */
  .flashcard-wrap { perspective: 1000px; width: 100%; height: 190px; cursor: pointer; margin-bottom: 14px; }
  .flashcard-inner { position: relative; width: 100%; height: 100%; transform-style: preserve-3d; transition: transform .5s; }
  .flashcard-inner.flipped { transform: rotateY(180deg); }
  .flashcard-face { position: absolute; inset: 0; backface-visibility: hidden; border-radius: 16px; display: flex; align-items: center; justify-content: center; padding: 24px; flex-direction: column; gap: 8px; box-shadow: 0 4px 20px rgba(0,0,0,.08); }
  .flashcard-front { background: #fff; color: #1a1410; }
  .flashcard-back { background: #1a1410; color: #f5f0e8; transform: rotateY(180deg); }
  .flash-nav { display: flex; gap: 10px; margin-bottom: 28px; align-items: center; }
  .flash-counter { display: flex; align-items: center; justify-content: center; color: #9a8a7a; font-size: 13px; min-width: 60px; font-family: 'DM Sans', sans-serif; }

  /* Vocab list */
  .vocab-card { background: #fff; border-radius: 12px; padding: 14px; margin-bottom: 10px; box-shadow: 0 2px 8px rgba(0,0,0,.05); }
  .vocab-word { font-size: 19px; font-weight: 700; }
  .vocab-context { font-size: 13px; color: #9a8a7a; border-left: 2px solid #ede8df; padding-left: 8px; margin: 4px 0; font-family: 'DM Sans', sans-serif; }
  .vocab-meta { font-size: 12px; color: #bbb; font-family: 'DM Sans', sans-serif; }
  .vocab-delete { float: right; background: none; border: none; cursor: pointer; color: #ccc; font-size: 16px; }

  /* Toast */
  .toast { position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%); background: #1a1410; color: #f5f0e8; padding: 10px 22px; border-radius: 20px; font-size: 13px; font-family: 'DM Sans', sans-serif; z-index: 100; opacity: 0; pointer-events: none; transition: opacity .3s; white-space: nowrap; }
  .toast.show { opacity: 1; }

  /* Done screen */
  .done-screen { justify-content: center; text-align: center; padding: 32px; }
</style>
</head>
<body>

<!-- ═══════════════════════════════ HOME ═══════════════════════════════════ -->
<div id="screen-home" class="screen active">
  <div class="topbar">
    <div class="logo">habla<b>.</b></div>
    <div class="nav"><button onclick="showVocab()">VOCAB</button></div>
  </div>
  <div class="body">
    <div class="lbl">Learn Spanish</div>
    <h1>Real news,<br>real language.</h1>
    <p class="sub">Read articles from top Spanish-language sources. Tap words to look up context and save vocab.</p>
    <div class="lbl">Choose your sources</div>
    <div id="source-list"></div>
    <div class="error-box" id="fetch-error"></div>
    <button class="btn-primary" id="load-btn" onclick="loadArticles()">Load articles &rarr;</button>
  </div>
</div>

<!-- ══════════════════════════════ STUDY ═══════════════════════════════════ -->
<div id="screen-study" class="screen">
  <div class="topbar">
    <div class="logo" onclick="goTo('home')">habla<b>.</b></div>
    <div class="nav">
      <button onclick="goTo('home')">HOME</button>
      <button onclick="showVocab()">VOCAB</button>
    </div>
  </div>
  <div class="body">
    <div class="progress" id="progress-bar"></div>

    <div class="card-wrap">
      <div class="swipe-label know" id="label-know">&#10003; Got it</div>
      <div class="swipe-label review" id="label-review">&#8629; Again</div>
      <div class="card" id="main-card"
        onpointerdown="dragStart(event)"
        onpointermove="dragMove(event)"
        onpointerup="dragEnd(event)"
        onpointercancel="dragEnd(event)">
        <div class="card-source" id="card-source"></div>
        <div class="card-title" id="card-title"></div>
        <div class="card-text" id="card-text"></div>
      </div>
    </div>

    <div class="word-actions">
      <button class="save-btn" id="save-btn" onclick="saveSelectedVocab()">Tap words to save vocab</button>
      <button class="context-btn" id="context-btn" onclick="lookupContext()">Context</button>
    </div>

    <div id="analysis-area"></div>

    <div class="action-row">
      <button class="btn-red" onclick="advance(false)">&#8629; Again</button>
      <button class="btn-green" onclick="advance(true)">&#10003; Got it</button>
    </div>
  </div>
</div>

<!-- ════════════════════════════════ DONE ══════════════════════════════════ -->
<div id="screen-done" class="screen done-screen">
  <div style="font-size:48px;margin-bottom:12px">&#127881;</div>
  <div style="font-size:28px;font-weight:700">All done!</div>
  <div id="done-subtitle" style="font-size:15px;color:#9a8a7a;margin:8px 0 24px;font-family:'DM Sans',sans-serif"></div>
  <button class="btn-primary" style="width:auto;padding:12px 28px;margin-top:0" onclick="goTo('home')">Load more &rarr;</button>
  <button class="btn-red" id="done-vocab-btn" style="width:auto;padding:12px 28px;margin-top:10px;display:none" onclick="showVocab()"></button>
</div>

<!-- ═══════════════════════════════ VOCAB ══════════════════════════════════ -->
<div id="screen-vocab" class="screen">
  <div class="topbar">
    <div class="logo" onclick="goTo('home')">habla<b>.</b></div>
    <div class="nav">
      <button onclick="goTo('home')">HOME</button>
      <button id="study-nav-btn" style="display:none" onclick="goTo('study')">STUDY</button>
    </div>
  </div>
  <div class="body">
    <div class="lbl">Saved vocab</div>
    <div id="vocab-count" style="font-size:28px;font-weight:700;margin-bottom:20px"></div>
    <div id="vocab-flashcard"></div>
    <div class="lbl" id="vocab-list-label" style="display:none">All words</div>
    <div id="vocab-list"></div>
  </div>
</div>

<div class="toast" id="toast">Saved to vocab!</div>

<script>
// ─── State ───────────────────────────────────────────────────────────────────
var cards = [];
var currentIdx = 0;
var selectedWordIndices = [];
var vocab = [];
var vocabFlashIdx = 0;
var selectedSources = ["bbc", "elpais"];
var dragState = null;

var SOURCE_NAMES = {
  bbc: "BBC Mundo",
  elpais: "El Pais",
  elmundo: "El Mundo",
  infobae: "Infobae",
  cnn: "CNN en Espanol"
};

// ─── Init ────────────────────────────────────────────────────────────────────
try { selectedSources = JSON.parse(localStorage.getItem("habla_sources") || '["bbc","elpais"]'); } catch(e) {}
try { vocab = JSON.parse(localStorage.getItem("habla_vocab") || "[]"); } catch(e) {}

function init() {
  buildSourceList();
  updateVocabButtons();
}

// ─── Navigation ──────────────────────────────────────────────────────────────
function goTo(screenName) {
  document.querySelectorAll(".screen").forEach(function(s) { s.classList.remove("active"); });
  document.getElementById("screen-" + screenName).classList.add("active");
}

function showVocab() {
  goTo("vocab");
  renderVocabScreen();
}

function updateVocabButtons() {
  var label = vocab.length ? "VOCAB (" + vocab.length + ")" : "VOCAB";
  document.querySelectorAll(".nav button").forEach(function(b) {
    if (b.textContent.indexOf("VOCAB") === 0) b.textContent = label;
  });
}

// ─── Source picker ───────────────────────────────────────────────────────────
function buildSourceList() {
  var list = document.getElementById("source-list");
  Object.keys(SOURCE_NAMES).forEach(function(id) {
    var btn = document.createElement("button");
    btn.className = "src-btn" + (selectedSources.indexOf(id) >= 0 ? " on" : "");

    var name = document.createElement("span");
    name.className = "src-name";
    name.textContent = SOURCE_NAMES[id];

    var ck = document.createElement("span");
    ck.className = "checkmark";
    ck.textContent = selectedSources.indexOf(id) >= 0 ? "✓" : "";

    btn.appendChild(name);
    btn.appendChild(ck);

    btn.onclick = function() {
      var i = selectedSources.indexOf(id);
      if (i >= 0) {
        selectedSources.splice(i, 1);
        btn.classList.remove("on");
        ck.textContent = "";
      } else {
        selectedSources.push(id);
        btn.classList.add("on");
        ck.textContent = "✓";
      }
      try { localStorage.setItem("habla_sources", JSON.stringify(selectedSources)); } catch(e) {}
    };

    list.appendChild(btn);
  });
}

// ─── Load articles ───────────────────────────────────────────────────────────
async function loadArticles() {
  if (!selectedSources.length) return;
  var btn = document.getElementById("load-btn");
  var errEl = document.getElementById("fetch-error");
  btn.disabled = true;
  btn.textContent = "Loading...";
  errEl.style.display = "none";
  try {
    var r = await fetch("/feeds?sources=" + selectedSources.join(","));
    var data = await r.json();
    if (!data.ok || !data.items || !data.items.length) throw new Error(data.error || "No articles found");
    cards = data.items;
    currentIdx = 0;
    renderCard();
    goTo("study");
    document.getElementById("study-nav-btn").style.display = "";
  } catch(e) {
    errEl.textContent = "Could not load: " + e.message;
    errEl.style.display = "block";
  }
  btn.disabled = false;
  btn.textContent = "Load articles \u2192";
}

// ─── Card rendering ──────────────────────────────────────────────────────────
function renderCard() {
  if (!cards[currentIdx]) return;
  var card = cards[currentIdx];
  selectedWordIndices = [];
  document.getElementById("analysis-area").innerHTML = "";

  document.getElementById("card-source").textContent = card.source;

  var titleEl = document.getElementById("card-title");
  titleEl.textContent = card.title || "";
  titleEl.style.display = card.title ? "" : "none";

  // Tokenize and render words as clickable spans
  var textEl = document.getElementById("card-text");
  textEl.innerHTML = "";
  var tokens = card.content.split(/(\s+)/);
  tokens.forEach(function(token, i) {
    if (/\S/.test(token)) {
      var span = document.createElement("span");
      span.className = "word";
      span.textContent = token;
      span.setAttribute("data-index", i);
      (function(idx, el) {
        el.onclick = function() { toggleWord(idx, el); };
      })(i, span);
      textEl.appendChild(span);
    } else {
      textEl.appendChild(document.createTextNode(token));
    }
  });

  renderProgressBar();
  updateWordActionButtons();

  var cardEl = document.getElementById("main-card");
  cardEl.style.transition = "";
  cardEl.style.transform = "";
  cardEl.style.borderColor = "transparent";
}

function renderProgressBar() {
  var el = document.getElementById("progress-bar");
  el.innerHTML = "";
  var count = Math.min(cards.length, 25);
  for (var i = 0; i < count; i++) {
    var dot = document.createElement("div");
    dot.className = "progress-dot" + (i <= currentIdx ? " done" : "");
    el.appendChild(dot);
  }
}

// ─── Word selection ──────────────────────────────────────────────────────────
function toggleWord(idx, el) {
  var pos = selectedWordIndices.indexOf(idx);
  if (pos >= 0) {
    selectedWordIndices.splice(pos, 1);
    el.classList.remove("selected");
  } else {
    selectedWordIndices.push(idx);
    el.classList.add("selected");
  }
  updateWordActionButtons();
}

function getSelectedPhrases() {
  if (!selectedWordIndices.length) return [];
  var tokens = cards[currentIdx].content.split(/(\s+)/);
  var sorted = selectedWordIndices.slice().sort(function(a, b) { return a - b; });
  var groups = [];
  var group = [sorted[0]];
  for (var i = 1; i < sorted.length; i++) {
    var between = tokens.slice(sorted[i-1]+1, sorted[i]).join("");
    if (/^\s*$/.test(between)) {
      group.push(sorted[i]);
    } else {
      groups.push(group);
      group = [sorted[i]];
    }
  }
  groups.push(group);
  return groups.map(function(g) {
    return tokens.slice(g[0], g[g.length-1]+1).join("").replace(/[.,!?;"'()\n]/g, "").trim();
  }).filter(Boolean);
}

function updateWordActionButtons() {
  var saveBtn = document.getElementById("save-btn");
  var ctxBtn = document.getElementById("context-btn");
  var phrases = getSelectedPhrases();
  if (phrases.length) {
    saveBtn.className = "save-btn active";
    saveBtn.textContent = 'Save: ' + phrases.map(function(p) { return '"' + p + '"'; }).join(", ");
    ctxBtn.className = "context-btn active";
  } else {
    saveBtn.className = "save-btn";
    saveBtn.textContent = "Tap words to save vocab";
    ctxBtn.className = "context-btn";
  }
}

// ─── Save vocab ───────────────────────────────────────────────────────────────
function saveSelectedVocab() {
  var phrases = getSelectedPhrases();
  if (!phrases.length) return;
  var card = cards[currentIdx];
  phrases.forEach(function(word) {
    vocab.push({
      id: Date.now() + Math.random(),
      word: word,
      context: card.content.slice(0, 120),
      source: card.source,
      saved: new Date().toLocaleDateString()
    });
  });
  try { localStorage.setItem("habla_vocab", JSON.stringify(vocab)); } catch(e) {}
  updateVocabButtons();
  clearSelection();
  showToast();
}

function clearSelection() {
  selectedWordIndices = [];
  document.querySelectorAll(".word.selected").forEach(function(el) { el.classList.remove("selected"); });
  updateWordActionButtons();
}

function showToast() {
  var t = document.getElementById("toast");
  t.classList.add("show");
  setTimeout(function() { t.classList.remove("show"); }, 2000);
}

// ─── Context lookup ───────────────────────────────────────────────────────────
async function lookupContext() {
  var phrases = getSelectedPhrases();
  if (!phrases.length) return;
  var phrase = phrases.join(" ");
  var content = cards[currentIdx].content;
  var el = document.getElementById("analysis-area");

  el.innerHTML = '<div class="loading-box">Looking up &ldquo;' + escHtml(phrase) + '&rdquo;...</div>';

  try {
    var r = await fetch("/lookup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phrase: phrase, context: content })
    });
    var data = await r.json();
    if (!data.ok) throw new Error(data.error || "Failed");
    var res = data.result;

    el.innerHTML =
      '<div class="analysis-box">' +
        '<div class="phrase-label">Selected phrase</div>' +
        '<div class="phrase-text">' + escHtml(phrase) + '</div>' +
        '<div class="translation">' + escHtml(res.translation || "") + '</div>' +
        (res.explanation ? '<div class="explanation">' + escHtml(res.explanation) + '</div>' : '') +
        '<button class="save-phrase-btn" onclick="saveSelectedVocab()">Save to vocab</button>' +
      '</div>';
  } catch(e) {
    el.innerHTML =
      '<div class="error-box" style="display:block">' + escHtml(e.message) +
      ' <button style="background:#c0392b;color:#fff;border:none;border-radius:6px;padding:6px 12px;cursor:pointer;font-family:DM Sans,sans-serif" onclick="lookupContext()">Retry</button>' +
      '</div>';
  }
}

// ─── Swipe / advance ──────────────────────────────────────────────────────────
function advance(know) {
  var card = document.getElementById("main-card");
  card.style.transition = "transform 0.35s ease";
  card.style.transform = know ? "translateX(120%) rotate(15deg)" : "translateX(-120%) rotate(-15deg)";
  setTimeout(function() {
    if (currentIdx < cards.length - 1) {
      currentIdx++;
      renderCard();
    } else {
      goTo("done");
      document.getElementById("done-subtitle").textContent = "You went through all " + cards.length + " articles.";
      var dvb = document.getElementById("done-vocab-btn");
      if (vocab.length) { dvb.style.display = ""; dvb.textContent = "Review vocab (" + vocab.length + ")"; }
    }
  }, 350);
}

// ─── Drag to swipe ────────────────────────────────────────────────────────────
function dragStart(ev) {
  dragState = { startX: ev.clientX, startY: ev.clientY, moved: false };
  document.getElementById("main-card").setPointerCapture(ev.pointerId);
}

function dragMove(ev) {
  if (!dragState) return;
  var dx = ev.clientX - dragState.startX;
  var dy = (ev.clientY - dragState.startY) * 0.3;
  if (!dragState.moved && Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
  dragState.moved = true;
  var card = document.getElementById("main-card");
  card.style.transition = "none";
  card.style.transform = "translate(" + dx + "px," + dy + "px) rotate(" + (dx * 0.08) + "deg)";
  card.style.borderColor = dx > 60 ? "#27ae60" : dx < -60 ? "#c0392b" : "transparent";
  document.getElementById("label-know").style.opacity = dx > 60 ? 1 : 0;
  document.getElementById("label-review").style.opacity = dx < -60 ? 1 : 0;
}

function dragEnd(ev) {
  if (!dragState) return;
  var dx = ev.clientX - dragState.startX;
  var moved = dragState.moved;
  dragState = null;
  document.getElementById("label-know").style.opacity = 0;
  document.getElementById("label-review").style.opacity = 0;
  if (!moved) return; // was a tap, not a swipe — let word clicks handle it
  if (dx > 80) advance(true);
  else if (dx < -80) advance(false);
  else {
    var card = document.getElementById("main-card");
    card.style.transition = "transform 0.35s cubic-bezier(0.34,1.56,0.64,1)";
    card.style.transform = "";
    card.style.borderColor = "transparent";
  }
}

// ─── Vocab screen ─────────────────────────────────────────────────────────────
function renderVocabScreen() {
  var countEl = document.getElementById("vocab-count");
  var flashEl = document.getElementById("vocab-flashcard");
  var listEl = document.getElementById("vocab-list");
  var listLabel = document.getElementById("vocab-list-label");

  countEl.textContent = vocab.length + " words saved";

  if (!vocab.length) {
    flashEl.innerHTML = '<p style="color:#9a8a7a;text-align:center;padding:40px 0;font-family:DM Sans,sans-serif">No vocab yet — tap words while studying.</p>';
    listEl.innerHTML = "";
    listLabel.style.display = "none";
    return;
  }

  if (vocabFlashIdx >= vocab.length) vocabFlashIdx = vocab.length - 1;
  var item = vocab[vocabFlashIdx];

  flashEl.innerHTML =
    '<div class="flashcard-wrap" onclick="this.querySelector(\'.flashcard-inner\').classList.toggle(\'flipped\')">' +
      '<div class="flashcard-inner">' +
        '<div class="flashcard-face flashcard-front">' +
          '<div style="font-size:26px;font-weight:700">' + escHtml(item.word) + '</div>' +
          '<div style="font-size:12px;color:#9a8a7a;font-family:DM Sans,sans-serif">tap to flip</div>' +
        '</div>' +
        '<div class="flashcard-face flashcard-back">' +
          '<div style="font-size:13px;opacity:.6;font-family:DM Sans,sans-serif;margin-bottom:4px">context</div>' +
          '<div style="font-size:15px;font-style:italic;text-align:center;line-height:1.5">"' + escHtml(item.context) + '"</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="flash-nav">' +
      '<button class="btn-red" style="flex:1" onclick="navFlashcard(-1)">&#8592;</button>' +
      '<div class="flash-counter">' + (vocabFlashIdx + 1) + ' / ' + vocab.length + '</div>' +
      '<button class="btn-green" style="flex:1" onclick="navFlashcard(1)">&#8594;</button>' +
    '</div>';

  listLabel.style.display = "";
  listEl.innerHTML = vocab.map(function(v, i) {
    return '<div class="vocab-card">' +
      '<button class="vocab-delete" onclick="deleteVocab(' + i + ')">&#215;</button>' +
      '<div class="vocab-word">' + escHtml(v.word) + '</div>' +
      '<div class="vocab-context">' + escHtml(v.context) + '</div>' +
      '<div class="vocab-meta">' + escHtml(v.source) + ' &middot; ' + escHtml(v.saved) + '</div>' +
    '</div>';
  }).join("");
}

function navFlashcard(dir) {
  vocabFlashIdx = Math.max(0, Math.min(vocab.length - 1, vocabFlashIdx + dir));
  renderVocabScreen();
}

function deleteVocab(i) {
  vocab.splice(i, 1);
  if (vocabFlashIdx >= vocab.length) vocabFlashIdx = Math.max(0, vocab.length - 1);
  try { localStorage.setItem("habla_vocab", JSON.stringify(vocab)); } catch(e) {}
  updateVocabButtons();
  renderVocabScreen();
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function escHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Start ────────────────────────────────────────────────────────────────────
init();
</script>
</body>
</html>`;
}
