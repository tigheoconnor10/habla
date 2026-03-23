const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

async function callClaude(prompt, apiKey) {
  const r = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  const text = d.content[0].text.trim().replace(/^```json\n?|\n?```$/g, "");
  return JSON.parse(text);
}

export async function lookupPhrase(phrase, context, apiKey) {
  const prompt =
    'The Spanish phrase "' + phrase + '" appears in this news article:\n\n"' +
    context.slice(0, 500) + '"\n\n' +
    "Return JSON with:\n" +
    "- translation: English translation of just this phrase\n" +
    "- explanation: 2-4 sentences explaining the meaning, usage, and any grammar or cultural notes. Reference how it is used in this specific sentence.\n\n" +
    "Respond with only the JSON object, no markdown.";
  return callClaude(prompt, apiKey);
}
