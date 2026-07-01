// Better YouTube Theater — content script
// Single source of truth for YouTube DOM selectors used from JS.
// (Layout selectors live in theater.css; docs/architecture.md points at both.)
// Verified against live YouTube DOM 2026-07-01.
const SEL = {
  flexy: 'ytd-watch-flexy',           // [theater] attribute = native theater mode
  chatFrame: 'ytd-live-chat-frame',   // streams/premieres/chat replay; [collapsed] = hidden
  chatExpand: 'ytd-live-chat-frame #show-hide-button',
};

// the real <button> nested in a Polymer wrapper — a comma selector would
// return the wrapper (document order), whose .click() does nothing
function innerButton(root, sel) {
  const el = root?.querySelector(sel);
  return el?.querySelector('button') || el || null;
}

const html = document.documentElement;
const state = { theater: false, sidebar: 'recs', ambient: true };
let lastExpandClick = 0;
let observedChat = null;
let chatSeenOpen = false;

// react to YouTube's own chat state changes (its ✕ header button) the moment
// the [collapsed] attribute lands — the frame is recreated per watch page,
// so re-attach whenever apply() sees a new one
function watchChat(chat) {
  if (!chat || chat === observedChat) return;
  observedChat = chat;
  new MutationObserver(() => apply()).observe(chat, { attributes: true, attributeFilter: ['collapsed'] });
}

// Idempotent: mirrors state onto <html>, keeps YouTube's native chat
// collapse in sync, and only pokes the player when something changed.
function apply() {
  const chat = document.querySelector(SEL.chatFrame);
  watchChat(chat);
  const collapsed = !!chat && chat.hasAttribute('collapsed');

  // two-way sync with YouTube's ✕ (in the chat header): we never collapse
  // chat ourselves, so if the chat we were showing turns collapsed, the user
  // (or YouTube) closed it — close the sidebar instead of re-expanding.
  if (state.theater && chat && state.sidebar === 'chat') {
    if (!collapsed) {
      chatSeenOpen = true;
    } else if (chatSeenOpen) {
      chatSeenOpen = false;
      state.sidebar = 'closed';
      chrome.storage.sync.set({ sidebar: 'closed' });
    }
  } else {
    chatSeenOpen = false;
  }

  // 'chat' is meaningless without a chat frame — fall back to recommendations
  const sidebar = state.sidebar === 'chat' && !chat ? 'recs' : state.sidebar;

  const changed =
    html.hasAttribute('byt-theater') !== state.theater ||
    html.hasAttribute('byt-live') !== !!chat ||
    html.hasAttribute('byt-ambient') !== state.ambient ||
    html.getAttribute('byt-sidebar') !== sidebar;
  html.toggleAttribute('byt-theater', state.theater);
  html.toggleAttribute('byt-live', !!chat);
  html.toggleAttribute('byt-ambient', state.ambient);
  html.setAttribute('byt-sidebar', sidebar);

  // Sync YouTube's native chat state: while expanded, YouTube reserves player
  // space (--ytd-watch-flexy-sidebar-width) even if we hide chat with CSS,
  // so recs/closed need it natively collapsed and chat needs it expanded.
  // Chat stays expanded permanently — --ytd-watch-flexy-sidebar-width is
  // zeroed in theater.css so YouTube never reserves player space for it, and
  // switching states is a pure CSS slide. Only expand if the page started
  // with chat collapsed (the outer show/hide button only expands; async, so
  // don't re-click for 3s). A user-✕'d chat never reaches this: the sync
  // above flips the sidebar to 'closed' first.
  let clickedChat = false;
  if (state.theater && chat && sidebar === 'chat' && collapsed
      && Date.now() - lastExpandClick > 3000) {
    const btn = innerButton(document, SEL.chatExpand);
    if (btn) {
      btn.click();
      lastExpandClick = Date.now();
      clickedChat = true;
    }
  }

  if (changed || clickedChat) {
    // YouTube's player only recomputes the <video> size on window resize.
    // dispatchEvent runs YouTube's (heavy on livestreams) handler
    // synchronously — deferred a frame so the new state paints and the
    // sidebar slide starts immediately instead of ~1s late.
    requestAnimationFrame(() => setTimeout(() => window.dispatchEvent(new Event('resize')), 0));
    if (clickedChat) setTimeout(() => window.dispatchEvent(new Event('resize')), 600); // chat mounts late
  }
}

// ponytail: 1.5s enforcement loop instead of observing YouTube's noisy DOM —
// catches late-mounting chat frames and anything that fights our state.
// apply() is idempotent and no-ops (no resize spam) when nothing changed.
setInterval(apply, 1500);

function setSidebar(mode) {
  // clicking the active mode's button toggles the sidebar closed
  state.sidebar = state.sidebar === mode ? 'closed' : mode;
  chrome.storage.sync.set({ sidebar: state.sidebar });
  apply();
}

function toggleAmbient() {
  state.ambient = !state.ambient;
  chrome.storage.sync.set({ ambient: state.ambient });
  apply();
}

// --- control cluster (recs / chat toggle sidebar, glow toggles ambient) --
// built with createElementNS, not innerHTML — YouTube enforces Trusted Types
const BUTTONS = [
  ['recs', 'Toggle recommendations',
    'M3 4h9v6H3zM14 5h7v1.5h-7zM14 8h5v1.5h-5zM3 13h9v6H3zM14 14h7v1.5h-7zM14 17h5v1.5h-5z'],
  ['chat', 'Toggle live chat',
    'M3 3h18v13H8l-5 4V3zm4 4.5h10V9H7V7.5zm0 3.5h7v1.5H7V11z'],
  ['ambient', 'Toggle ambient glow',
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM11 1h2v4h-2zM11 19h2v4h-2zM1 11h4v2H1zM19 11h4v2h-4zM4.2 5.6l1.4-1.4 2.9 2.8-1.5 1.4zM15.5 16.9l1.4-1.4 2.9 2.8-1.4 1.4zM4.2 18.4l2.9-2.9 1.4 1.5-2.9 2.8zM15.5 7l2.9-2.8 1.4 1.4-2.9 2.8z'],
];

function buildCluster() {
  if (document.getElementById('byt-cluster')) return;
  const el = document.createElement('div');
  el.id = 'byt-cluster';
  const NS = 'http://www.w3.org/2000/svg';
  for (const [mode, label, d] of BUTTONS) {
    const b = document.createElement('button');
    b.dataset.mode = mode;
    b.title = label;
    b.setAttribute('aria-label', label);
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    svg.append(path);
    b.append(svg);
    b.addEventListener('click', () => (mode === 'ambient' ? toggleAmbient() : setSidebar(mode)));
    el.append(b);
  }
  document.body.append(el);
}

// --- theater mode detection ---------------------------------------------
function hookFlexy() {
  const flexy = document.querySelector(SEL.flexy);
  if (!flexy) {
    setTimeout(hookFlexy, 300); // ponytail: poll until the SPA renders it
    return;
  }
  const sync = () => {
    // no pathname check: streams also live at /@channel/live; YouTube marks
    // the watch page inactive with [hidden] instead
    state.theater = flexy.hasAttribute('theater') && !flexy.hasAttribute('hidden');
    apply();
  };
  new MutationObserver(sync).observe(flexy, { attributes: true, attributeFilter: ['theater'] });
  window.addEventListener('yt-navigate-finish', sync);
  sync();
}

// masthead also reveals once you've scrolled down to the video info
window.addEventListener('scroll', () => {
  html.classList.toggle('byt-scrolled', window.scrollY > window.innerHeight * 0.35);
}, { passive: true });

// --- masthead reveal: hover-intent + grace period ------------------------
// content.js (not CSS :hover) drives `.byt-masthead-open` so the cluster can
// ride below the open masthead without hover feedback loops: hovering the
// cluster HOLDS the masthead open but never opens it.
function hookMasthead() {
  const mh = document.querySelector('#masthead-container');
  const cluster = document.getElementById('byt-cluster');
  if (!mh || !cluster) {
    setTimeout(hookMasthead, 300);
    return;
  }
  let openTimer = null, closeTimer = null;
  const open = () => {
    clearTimeout(closeTimer);
    html.classList.add('byt-masthead-open');
  };
  const scheduleClose = () => {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => html.classList.remove('byt-masthead-open'), 250);
  };
  mh.addEventListener('mouseenter', () => { openTimer = setTimeout(open, 150); });
  mh.addEventListener('mouseleave', () => { clearTimeout(openTimer); scheduleClose(); });
  mh.addEventListener('focusin', open); // keep open while typing in search
  mh.addEventListener('focusout', scheduleClose);
  cluster.addEventListener('mouseenter', () => {
    if (html.classList.contains('byt-masthead-open')) clearTimeout(closeTimer);
  });
  cluster.addEventListener('mouseleave', () => {
    if (html.classList.contains('byt-masthead-open')) scheduleClose();
  });
}

chrome.storage.sync.get({ sidebar: 'recs', ambient: true }, (v) => {
  Object.assign(state, v);
  apply();
});
chrome.storage.onChanged.addListener((changes) => {
  if (changes.sidebar) state.sidebar = changes.sidebar.newValue;
  if (changes.ambient) state.ambient = changes.ambient.newValue;
  apply();
});

buildCluster();
hookFlexy();
hookMasthead();
