const axios = require("axios");
const cheerio = require("cheerio");

class CrawlerService {

  static async crawl(targetUrl, maxPages = 10) {

    const visited = new Set();
    const queue = [targetUrl];
    const endpoints = [];

    const baseDomain = new URL(targetUrl).hostname;

    while (queue.length > 0 && visited.size < maxPages) {

      const currentUrl = queue.shift();

      if (visited.has(currentUrl)) continue;

      visited.add(currentUrl);

      try {

        const res = await axios.get(currentUrl, {
          timeout: 5000,
          headers: {
            "User-Agent": "SecurityScanner"
          }
        });

        const $ = cheerio.load(res.data);

        $("a").each((i, link) => {

          let href = $(link).attr("href");

          if (!href) return;

          try {

            const absoluteUrl =
              new URL(href, currentUrl).href;

            const hostname =
              new URL(absoluteUrl).hostname;

      
            if (hostname === baseDomain) {

              if (!visited.has(absoluteUrl)) {
                queue.push(absoluteUrl);
              }

              endpoints.push(absoluteUrl);

            }

          } catch (err) {}

        });

      } catch (err) {
        console.log("Crawler error:", err.message);
      }

    }

    return [...new Set(endpoints)];

  }

}

module.exports = CrawlerService;