export const SOURCES = {
  bbc:     { name: "BBC Mundo",      url: "https://feeds.bbci.co.uk/mundo/rss.xml" },
  elpais:  { name: "El Pais",        url: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada" },
  elmundo: { name: "El Mundo",       url: "https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml" },
  infobae: { name: "Infobae",        url: "https://www.infobae.com/feeds/rss/" },
  cnn:     { name: "CNN en Espanol", url: "https://cnnespanol.cnn.com/feed/" },
};

function cleanText(html) {
  return (html || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();
}

function parseRSS(xml, srcId) {
  const source = SOURCES[srcId];
  const items = [];
  const rx = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = rx.exec(xml)) !== null) {
    const block = m[1];
    const get = (tag) => {
      const r = block.match(new RegExp("<" + tag + "[^>]*>([\\s\\S]*?)</" + tag + ">", "i"));
      return r ? cleanText(r[1]) : "";
    };
    const title = get("title");
    const desc = get("description") || get("summary") || get("content:encoded");
    const content = desc.length > 80 ? desc.slice(0, 500) : title;
    if (content.length > 60) {
      items.push({
        id: srcId + "-" + Math.random(),
        source: source.name,
        title: title.slice(0, 120),
        content,
      });
    }
  }
  return items;
}

export async function fetchFeeds(sourceIds) {
  const all = [];
  await Promise.all(
    sourceIds.map(async (id) => {
      if (!SOURCES[id]) return;
      try {
        const r = await fetch(SOURCES[id].url, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (r.ok) {
          const items = parseRSS(await r.text(), id);
          items.slice(0, 10).forEach((item) => all.push(item));
        }
      } catch (e) {
        // skip failed source
      }
    })
  );
  return all.sort(() => Math.random() - 0.5).slice(0, 30);
}
