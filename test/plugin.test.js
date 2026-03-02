import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile, rm, access } from "node:fs/promises";
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

  // after(async () => {
  //   await rm(outputDir, { recursive: true, force: true });
  // });

  describe("markdown copy", () => {
    it("copies index.md to output root", async () => {
      const content = await readFile(join(outputDir, "index.md"), "utf8");
      assert.ok(content.includes("# Welcome"));
    });

    it("copies nested markdown to correct path", async () => {
      const content = await readFile(join(outputDir, "docs/foo.md"), "utf8");
      assert.ok(content.includes("# Foo"));
    });

    it("preserves frontmatter in copied files", async () => {
      const content = await readFile(join(outputDir, "docs/foo.md"), "utf8");
      assert.ok(content.startsWith("---"));
      assert.ok(content.includes("title: Foo"));
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

    it("stores full raw markdown including frontmatter", () => {
      const row = db
        .prepare("SELECT content FROM pages WHERE path = ?")
        .get("/");
      assert.ok(row.content.includes("# Welcome"));
      assert.ok(row.content.includes("---"));
      assert.ok(row.content.includes("title: Home"));
    });

    it("stores tags as JSON array", () => {
      const row = db
        .prepare("SELECT tags FROM pages WHERE path = ?")
        .get("/docs/foo/");
      assert.deepEqual(JSON.parse(row.tags), ["docs"]);
    });

    it("stores null tags when page has no tags", () => {
      const row = db
        .prepare("SELECT tags FROM pages WHERE path = ?")
        .get("/");
      assert.equal(row.tags, null);
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

    it("supports prefix queries", () => {
      const rows = db
        .prepare(
          "SELECT p.path FROM pages p JOIN pages_fts f ON p.rowid = f.rowid WHERE pages_fts MATCH ?",
        )
        .all("Wel*");
      assert.ok(rows.some((r) => r.path === "/"));
    });
  });
});
