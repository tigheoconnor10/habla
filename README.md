# habla.

Learn Spanish by reading real news articles. Tap words to look up context and save vocab.

## Files

- `worker.js` — Cloudflare Worker entry point, routes requests
- `feeds.js` — RSS fetching and parsing logic
- `analyze.js` — Claude API calls for phrase lookup
- `app.html.js` — The entire frontend app (HTML/CSS/JS)

## Making changes

**To change the UI:** edit `app.html.js`
**To add a news source:** edit the `SOURCES` object in `feeds.js`
**To change how phrases are explained:** edit the prompt in `analyze.js`

## Setup

1. Clone this repo
2. Install Wrangler: `npm install -g wrangler`
3. Log in: `wrangler login`
4. Set your API key: `wrangler secret put ANTHROPIC_API_KEY`
5. Deploy: `wrangler deploy`

## Local development

\`\`\`
wrangler dev
\`\`\`

Then open http://localhost:8787

## Using Claude Code for improvements

Run `claude` in this folder and describe what you want to change.
Example: "Add a difficulty filter so I can choose between beginner and advanced articles"
