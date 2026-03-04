import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile, rm, access, stat } from "node:fs/promises";
import { join } from "node:path";
import Eleventy from "@11ty/eleventy";
import Database from "better-sqlite3";

const fixturesDir = new URL("./fixtures/", import.meta.url).pathname;
const inputDir = join(fixturesDir, "src");
const outputDir = join(fixturesDir, "_site");

describe("eleventy-plugin-mdlite", () => {
  before(async () => {
    await rm(outputDir, { recursive: true, force: true });

    const elev = new Eleventy(inputDir, outputDir, {
      configPath: join(fixturesDir, "eleventy.config.js"),
      quietMode: true,
    });
    await elev.write();
  });

  after(async () => {
    await rm(outputDir, { recursive: true, force: true });
  });

  describe("markdown copy", () => {
    it("copies index.md to output root", async () => {
      const content = await readFile(join(outputDir, "index.md"), "utf8");
      assert.ok(content.includes("# Welcome"));
    });

    it("copies nested markdown to correct path", async () => {
      const content = await readFile(join(outputDir, "docs/foo.md"), "utf8");
      assert.ok(content.includes("# Foo"));
    });

    it("strips frontmatter from copied files", async () => {
      const content = await readFile(join(outputDir, "docs/foo.md"), "utf8");
      assert.ok(!content.startsWith("---"), "output should not start with frontmatter delimiter");
      assert.ok(!content.includes("title: Foo"), "output should not contain frontmatter fields");
      assert.ok(!content.includes("layout: false"), "output should not contain frontmatter fields");
    });

    it("preserves horizontal rules in content", async () => {
      const content = await readFile(join(outputDir, "docs/foo.md"), "utf8");
      assert.ok(content.includes("---"), "output should preserve horizontal rules");
    });

    it("does not emit empty pages as markdown files", async () => {
      await assert.rejects(access(join(outputDir, "docs/empty.md")));
    });

    it("expands Liquid output tags using page data", async () => {
      const content = await readFile(join(outputDir, "index.md"), "utf8");
      assert.ok(
        content.includes("Expanded snippet value"),
        "output should contain the expanded snippet value",
      );
      assert.ok(
        !content.includes("{{ snippet }}"),
        "output should not contain raw Liquid tag",
      );
    });

    it("converts inline paired shortcodes to inline code", async () => {
      const content = await readFile(join(outputDir, "index.md"), "utf8");
      assert.ok(
        content.includes("`const x = 1;`"),
        "single-line paired shortcode should be wrapped in inline backticks",
      );
      assert.ok(
        !content.includes("{%"),
        "output should not contain {% block tags",
      );
    });

    it("converts multiline paired shortcodes to fenced code blocks", async () => {
      const content = await readFile(join(outputDir, "index.md"), "utf8");
      assert.ok(
        content.includes('```\ndef hello():\n    print("world")\n```'),
        "multiline paired shortcode should be wrapped in a fenced code block",
      );
    });

    it("passes through unknown filters without error", async () => {
      const content = await readFile(join(outputDir, "index.md"), "utf8");
      assert.ok(
        content.includes("Expanded snippet value"),
        "unknown filter should still resolve the variable",
      );
    });
  });

  describe("sqlite database", () => {
    let db;

    before(() => {
      db = new Database(join(outputDir, "sqlite.db"), { readonly: true });
    });

    after(() => {
      db.close();
    });

    it("creates sqlite.db in output", async () => {
      await access(join(outputDir, "sqlite.db"));
    });

    it("has pages table with correct schema", () => {
      const cols = db.pragma("table_info(pages)").map((c) => c.name);
      assert.deepEqual(cols, ["path", "title", "tags", "content"]);
    });

    it("contains expected page rows", () => {
      const rows = db.prepare("SELECT path FROM pages ORDER BY path").all();
      const paths = rows.map((r) => r.path);
      assert.ok(paths.includes("/"));
      assert.ok(paths.includes("/docs/foo/"));
    });

    it("stores content without frontmatter", () => {
      const row = db
        .prepare("SELECT content FROM pages WHERE path = ?")
        .get("/");
      assert.ok(row.content.includes("# Welcome"));
      assert.ok(!row.content.includes("---"));
      assert.ok(!row.content.includes("title: Home"));
    });

    it("stores expanded Liquid content in the database", () => {
      const row = db
        .prepare("SELECT content FROM pages WHERE path = ?")
        .get("/");
      assert.ok(
        row.content.includes("Expanded snippet value"),
        "database content should contain expanded snippet value",
      );
      assert.ok(
        !row.content.includes("{{ snippet }}"),
        "database content should not contain raw Liquid tags",
      );
    });

    it("stores tags as JSON array", () => {
      const row = db
        .prepare("SELECT tags FROM pages WHERE path = ?")
        .get("/docs/foo/");
      assert.deepEqual(JSON.parse(row.tags), ["docs"]);
    });

    it("stores null tags when page has no tags", () => {
      const row = db.prepare("SELECT tags FROM pages WHERE path = ?").get("/");
      assert.equal(row.tags, null);
    });

    it("does not insert empty pages into the database", () => {
      const row = db
        .prepare("SELECT * FROM pages WHERE path = ?")
        .get("/docs/empty/");
      assert.equal(row, undefined);
    });

    it("supports full-text search", () => {
      const rows = db
        .prepare(
          "SELECT p.path FROM pages p JOIN pages_fts f ON p.rowid = f.rowid WHERE pages_fts MATCH ? ORDER BY rank",
        )
        .all("Welcome");
      assert.ok(rows.some((r) => r.path === "/"));
    });

    it("supports porter stemming", () => {
      // "Welcomed" should match content containing "Welcome" via stemming
      const rows = db
        .prepare(
          "SELECT p.path FROM pages p JOIN pages_fts f ON p.rowid = f.rowid WHERE pages_fts MATCH ?",
        )
        .all("Welcomed");
      assert.ok(rows.some((r) => r.path === "/"));
    });

    it("FTS index reads content from pages table", () => {
      const page = db
        .prepare("SELECT rowid, content FROM pages WHERE path = ?")
        .get("/docs/foo/");
      const fts = db
        .prepare("SELECT content FROM pages_fts WHERE rowid = ?")
        .get(page.rowid);
      assert.equal(fts.content, page.content);
    });

  });
});

describe("eleventy-plugin-mdlite with pathPrefix", () => {
  const prefixedOutputDir = join(fixturesDir, "_site_prefixed");

  before(async () => {
    await rm(prefixedOutputDir, { recursive: true, force: true });

    const elev = new Eleventy(inputDir, prefixedOutputDir, {
      configPath: join(fixturesDir, "eleventy.config.prefixed.js"),
      quietMode: true,
    });
    await elev.write();
  });

  after(async () => {
    await rm(prefixedOutputDir, { recursive: true, force: true });
  });

  it("places sqlite.db inside the prefixed subdirectory", async () => {
    await access(join(prefixedOutputDir, "docs", "sqlite.db"));
  });

  it("does not place sqlite.db in the output root", async () => {
    await assert.rejects(access(join(prefixedOutputDir, "sqlite.db")));
  });

  describe("sqlite database", () => {
    let db;

    before(() => {
      db = new Database(join(prefixedOutputDir, "docs", "sqlite.db"), {
        readonly: true,
      });
    });

    after(() => {
      db.close();
    });

    it("only contains pages under the prefix", () => {
      const rows = db.prepare("SELECT path FROM pages ORDER BY path").all();
      const paths = rows.map((r) => r.path);
      assert.ok(paths.includes("/docs/foo/"));
      assert.ok(!paths.includes("/"), "root page should be excluded");
    });

    it("does not copy markdown files outside the prefix", async () => {
      // index.md at root should still exist (eleventy writes it) but
      // the plugin should not have indexed it
      const rows = db.prepare("SELECT COUNT(*) as count FROM pages").get();
      // only docs/foo and docs/draft-post
      for (const r of db.prepare("SELECT path FROM pages").all()) {
        assert.ok(
          r.path.startsWith("/docs/"),
          `${r.path} should start with /docs/`,
        );
      }
    });
  });
});
