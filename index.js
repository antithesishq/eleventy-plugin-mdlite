import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";

function createSchema(db) {
  db.exec(`
    CREATE TABLE pages (
      path TEXT PRIMARY KEY,
      title TEXT,
      tags TEXT,
      content TEXT NOT NULL
    )
  `);

  // https://sqlite.org/fts5.html
  db.exec(`
    CREATE VIRTUAL TABLE pages_fts USING fts5(
      title,
      content,
      content='pages',
      content_rowid='rowid',
      tokenize='porter unicode61',
      prefix='2 3'
    )
  `);

  db.exec(`
    CREATE TRIGGER pages_ai AFTER INSERT ON pages BEGIN
      INSERT INTO pages_fts(rowid, title, content)
      VALUES (new.rowid, new.title, new.content);
    END
  `);
}

export default function mdlitePlugin(eleventyConfig, options = {}) {
  const { dbFilename = "sqlite.db", pathPrefix = "/" } = options;
  // Normalize to "/prefix/" form so startsWith() works on URLs.
  // "docs", "/docs", "/docs/" all become "/docs/"; "/" stays as "/".
  const normalizedPrefix =
    pathPrefix === "/"
      ? "/"
      : "/" + pathPrefix.replace(/^\/|\/$/g, "") + "/";
  const pageDataByInputPath = new Map();

  eleventyConfig.addCollection("__mdlite_capture", (collectionApi) => {
    for (const item of collectionApi.getAll()) {
      pageDataByInputPath.set(item.inputPath, item.data);
    }
    return [];
  });

  eleventyConfig.on("eleventy.after", async ({ directories, results }) => {
    const outputDir = directories.output;

    // Filter to markdown inputs with valid output under pathPrefix
    const mdResults = results.filter((r) => {
      return (
        r.inputPath.endsWith(".md") &&
        r.outputPath &&
        r.url.startsWith(normalizedPrefix)
      );
    });

    const dbDir =
      normalizedPrefix === "/"
        ? outputDir
        : join(outputDir, normalizedPrefix.slice(1, -1));
    const dbPath = join(dbDir, dbFilename);
    await mkdir(dbDir, { recursive: true });
    await rm(dbPath, { force: true });

    const db = new Database(dbPath);
    createSchema(db);

    const insert = db.prepare(
      "INSERT INTO pages (path, title, tags, content) VALUES (?, ?, ?, ?)",
    );

    for (const result of mdResults) {
      const data = pageDataByInputPath.get(result.inputPath) || {};
      const raw = await readFile(result.inputPath, "utf8");
      const tags = Array.isArray(data.tags) ? JSON.stringify(data.tags) : null;

      // Copy raw markdown to output: /docs/foo/ → _site/docs/foo.md
      let mdOutputPath;
      if (result.url.endsWith("/")) {
        const trimmed = result.url.slice(0, -1) || "/index";
        mdOutputPath = join(outputDir, trimmed + ".md");
      } else {
        mdOutputPath = join(outputDir, result.url + ".md");
      }
      await mkdir(dirname(mdOutputPath), { recursive: true });
      await writeFile(mdOutputPath, raw);

      insert.run(result.url, data.title ?? null, tags, raw);
    }

    db.exec("VACUUM");
    db.close();
  });
}
