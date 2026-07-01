# Better YouTube Theater

Twitch-style theater mode for YouTube. Press `t` and the video fills the browser viewport — no fullscreen, your tabs stay visible — with a single right-hand column for recommendations or live chat.

## Features

- **Full-viewport theater**: replaces YouTube's height-capped native theater mode. Scroll down for title, description, and comments as usual.
- **Twitch-style sidebar**: toggle between recommendations and live chat (streams), or close it for edge-to-edge video. The video shrinks — nothing ever covers it.
- **Hidden search bar**: the YouTube masthead slides away; hover the top edge or scroll down to bring it back. The sidebar buttons ride below it automatically.
- **Ambient glow**: YouTube's Ambient Mode glow, unclipped and boosted, framing the video. Toggle with the sun button (regular videos, dark theme + Ambient Mode on).
- Works with YouTube's own controls: closing chat with YouTube's ✕ closes the sidebar too.
- No frameworks, no build step, no tracking — a content script, a stylesheet, and `chrome.storage` for your two preferences.

## Install

**Chrome Web Store**: (pending review)

**From source**: download/clone this repo → `chrome://extensions` → enable Developer mode → **Load unpacked** → select the folder.

## Use

- `t` or the player's theater button toggles the mode (it hijacks YouTube's native theater).
- Buttons at the video's top-right corner: recommendations / live chat / ambient glow. Click the active one to close the sidebar.
- The extension's popup sets your default sidebar state.
