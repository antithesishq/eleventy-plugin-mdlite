import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";
import nunjucks from "nunjucks";

function createSchema(db) {
  db.exec(`
    CREATE TABLE pages (
      path TEXT PRIMARY KEY,
      title TEXT,
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
    );
    INSERT INTO pages_fts(pages_fts, rank) VALUES('rank', 'bm25(5.0, 1.0)')
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
  const {
    dbFilename = "sqlite.db",
    pathPrefix = "/",
    header = "",
  } = options;

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
    const includesDir =
      directories.includes || join(directories.input, "_includes");
    const loader = new nunjucks.FileSystemLoader(includesDir);
    const env = new nunjucks.Environment(loader, {
      throwOnUndefined: false,
      autoescape: false,
    });

    for (const name of Object.keys(eleventyConfig.getPairedShortcodes())) {
      env.addExtension(name, {
        tags: [name],
        parse(parser, nodes) {
          const tok = parser.nextToken();
          const src = parser.tokens.str;
          const tagStart = src.lastIndexOf("{%", parser.tokens.index);
          const args = parser.parseSignature(null, true);
          parser.advanceAfterBlockEnd(tok.value);
          parser.parseUntilBlocks("end" + name);
          parser.advanceAfterBlockEnd();
          const rawText = src.slice(tagStart, parser.tokens.index);
          const rawNode = new nodes.Literal(tok.lineno, tok.colno, rawText);
          return new nodes.CallExtension(
            this,
            "run",
            new nodes.NodeList(tok.lineno, tok.colno, [rawNode]),
          );
        },
        run(context, rawText) {
          return new nunjucks.runtime.SafeString(rawText);
        },
      });
    }

    const shortcodes = eleventyConfig.getShortcodes();
    for (const [name, fn] of Object.entries(shortcodes)) {
      env.addExtension(name, {
        tags: [name],
        parse(parser, nodes) {
          const tok = parser.nextToken();
          const args = parser.parseSignature(null, true);
          parser.advanceAfterBlockEnd(tok.value);
          return new nodes.CallExtensionAsync(this, "run", args);
        },
        run(context, ...args) {
          const cb = args.pop();
          try {
            const result = fn(...args);
            if (result && typeof result.then === "function") {
              result.then(
                (val) => cb(null, new nunjucks.runtime.SafeString(val)),
                (err) => cb(err),
              );
            } else {
              cb(null, new nunjucks.runtime.SafeString(result));
            }
          } catch (err) {
            cb(err);
          }
        },
      });
    }

    const filters = eleventyConfig.getFilters();
    for (const [name, fn] of Object.entries(filters)) {
      env.addFilter(name, fn);
    }

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
      "INSERT INTO pages (path, title, content) VALUES (?, ?, ?)",
    );

    for (const result of mdResults) {
      const data = pageDataByInputPath.get(result.inputPath) || {};
      const raw = await readFile(result.inputPath, "utf8");
      const stripped = stripFrontmatter(raw);
      let content;
      try {
        content = await new Promise((resolve, reject) => {
          env.renderString(stripped, data, (err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          });
        });
      } catch (err) {
        console.error(
          `[mdlite] render failed for ${result.inputPath}: ${err.message}`,
        );
        content = stripped;
      }

      // Skip pages that are empty after stripping frontmatter
      if (!content.trim()) {
        continue;
      }

      content = content.replace(/^\n/, "");

      // Copy markdown to output: /docs/foo/ → _site/docs/foo.md
      let mdOutputPath;
      if (result.url.endsWith("/")) {
        const trimmed = result.url.slice(0, -1) || "/index";
        mdOutputPath = join(outputDir, trimmed + ".md");
      } else {
        mdOutputPath = join(outputDir, result.url + ".md");
      }
      await mkdir(dirname(mdOutputPath), { recursive: true });
      const output = header ? header + "\n\n" + content : content;
      await writeFile(mdOutputPath, output);

      insertPage.run(result.url, data.title ?? null, content);
    }

    db.exec("INSERT INTO pages_fts(pages_fts) VALUES('optimize')");
    db.exec("VACUUM");
    db.close();
  });
}
