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
  // External content FTS table backed by the pages table.
  db.exec(`
    CREATE VIRTUAL TABLE pages_fts USING fts5(
      title,
      content,
      content=pages,
      content_rowid=rowid,
      tokenize='porter unicode61'
    )
  `);

  db.exec(`
    CREATE TRIGGER pages_ai AFTER INSERT ON pages BEGIN
      INSERT INTO pages_fts(rowid, title, content)
        VALUES (new.rowid, new.title, new.content);
    END
  `);
}

function stripFrontmatter(raw) {
  if (!raw.startsWith("---")) {
    return raw;
  }
  // Find the closing --- delimiter (start at 3 to skip past the opening ---)
  const end = raw.indexOf("---", 3);
  if (end === -1) {
    return raw;
  }
  // Slice past the closing --- and trim the leading newline
  return raw.slice(end + 3).replace(/^\r?\n/, "");
}

export default function mdlitePlugin(eleventyConfig, options = {}) {
  const { dbFilename = "sqlite.db", pathPrefix = "/", header = "" } = options;
  // Normalize to "/prefix/" form so startsWith() works on URLs.
  // "docs", "/docs", "/docs/" all become "/docs/"; "/" stays as "/".
  const normalizedPrefix =
    pathPrefix === "/" ? "/" : "/" + pathPrefix.replace(/^\/|\/$/g, "") + "/";
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

    const insertPage = db.prepare(
      "INSERT INTO pages (path, title, tags, content) VALUES (?, ?, ?, ?)",
    );

    for (const result of mdResults) {
      const data = pageDataByInputPath.get(result.inputPath) || {};
      const raw = await readFile(result.inputPath, "utf8");
      const content = stripFrontmatter(raw);

      // Skip pages that are empty after stripping frontmatter
      if (!content.trim()) {
        continue;
      }

      const tags = Array.isArray(data.tags) ? JSON.stringify(data.tags) : null;

      // Copy markdown to output: /docs/foo/ → _site/docs/foo.md
      let mdOutputPath;
      if (result.url.endsWith("/")) {
        const trimmed = result.url.slice(0, -1) || "/index";
        mdOutputPath = join(outputDir, trimmed + ".md");
      } else {
        mdOutputPath = join(outputDir, result.url + ".md");
      }
      await mkdir(dirname(mdOutputPath), { recursive: true });
      const output = header ? header + "\n" + content : content;
      await writeFile(mdOutputPath, output);

      insertPage.run(
        result.url,
        data.title ?? null,
        tags,
        content,
      );
    }

    db.exec("VACUUM");
    db.close();
  });
}
