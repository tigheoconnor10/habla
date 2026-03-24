# habla.

Learn Spanish by reading real news articles. Tap words to look up context and save vocab.

## Files

- `worker.js` — Cloudflare Worker entry point and current source of truth for the app
- `feeds.js` — older split-out RSS helper, not wired into Wrangler
- `analyze.js` — older split-out Anthropic helper, not wired into Wrangler
- `app.html.js` — older split-out frontend file, not wired into Wrangler

## Making changes

**To change the deployed app:** edit `worker.js`
**To add a news source:** edit the `RSS_SOURCES` object in `worker.js`
**To change how phrases are explained:** edit the prompts in `worker.js`

The split files are left here as reference only. Wrangler serves `worker.js` directly via `main = "worker.js"`.

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
