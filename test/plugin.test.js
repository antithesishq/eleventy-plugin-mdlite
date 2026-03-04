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

    it("expands nested data paths", async () => {
      const content = await readFile(join(outputDir, "index.md"), "utf8");
      assert.ok(
        content.includes("[Contact us](/contact/)"),
        "output should contain expanded docsub.contact_us value",
      );
      assert.ok(
        !content.includes("{{ docsub.contact_us }}"),
        "output should not contain raw nested variable tag",
      );
    });

    it("leaves unresolved variables empty", async () => {
      const content = await readFile(join(outputDir, "index.md"), "utf8");
      assert.ok(
        !content.includes("{{ unknown_var }}"),
        "unresolved variables should not appear as raw tags",
      );
    });

    it("passes through unknown filters without error", async () => {
      const content = await readFile(join(outputDir, "index.md"), "utf8");
      assert.ok(
        content.includes("Expanded snippet value"),
        "unknown filter should still resolve the variable",
      );
      // Verify filters with parenthesized Nunjucks args execute correctly
      assert.ok(
        content.includes("<ul><li>Home</li></ul>"),
        "list_nav_children filter should produce its real output",
      );
    });

    it("expands collections.all piped through a filter", async () => {
      const content = await readFile(join(outputDir, "index.md"), "utf8");
      assert.ok(
        content.includes("6"),
        "collections.all | foo should resolve to the collection length",
      );
      assert.ok(
        !content.includes("collections.all"),
        "output should not contain raw collections.all reference",
      );
    });

    it("expands includes", async () => {
      const content = await readFile(join(outputDir, "index.md"), "utf8");
      assert.ok(
        content.includes("This content was included from a shared file."),
        "output should contain included file content",
      );
      assert.ok(
        !content.includes("{% include"),
        "output should not contain raw include tag",
      );
    });

    it("preserves paired shortcode tags and body content", async () => {
      const content = await readFile(join(outputDir, "index.md"), "utf8");
      assert.ok(
        content.includes('{% highlight "js" %}const x = 1;{% endhighlight %}'),
        "paired shortcode tags and body content should be preserved",
      );
    });

    it("executes unpaired shortcodes", async () => {
      const content = await readFile(join(outputDir, "index.md"), "utf8");
      assert.ok(
        content.includes('<img src="/image.png">'),
        "unpaired shortcode should produce its real output",
      );
    });

    it("preserves fenced code block contents", async () => {
      const content = await readFile(join(outputDir, "index.md"), "utf8");
      assert.ok(
        content.includes('${{ secrets.GH_PAT }}'),
        "code block should preserve Liquid-like variable syntax",
      );
      assert.ok(
        content.includes('{{"input", x}}'),
        "code block should preserve C++ double-brace syntax",
      );
    });

    it("preserves container directives", async () => {
      const content = await readFile(
        join(outputDir, "docs/directives.md"),
        "utf8",
      );
      assert.ok(
        content.includes(":::note"),
        "output should preserve :::note directive",
      );
      assert.ok(
        content.includes(":::warning"),
        "output should preserve :::warning directive",
      );
    });

    it("preserves attribute syntax", async () => {
      const content = await readFile(
        join(outputDir, "docs/directives.md"),
        "utf8",
      );
      assert.ok(
        content.includes("{.purple}"),
        "output should preserve class attribute syntax",
      );
      assert.ok(
        content.includes('{id="section-anchor"}'),
        "output should preserve id attribute syntax",
      );
    });

    it("preserves inline HTML", async () => {
      const content = await readFile(
        join(outputDir, "docs/directives.md"),
        "utf8",
      );
      assert.ok(
        content.includes("<kbd>Ctrl</kbd>"),
        "output should preserve kbd elements",
      );
      assert.ok(
        content.includes("<small>fine print</small>"),
        "output should preserve small elements",
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
      assert.deepEqual(cols, ["path", "title", "content"]);
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

    it("stores expanded includes and nested data in the database", () => {
      const row = db
        .prepare("SELECT content FROM pages WHERE path = ?")
        .get("/");
      assert.ok(
        row.content.includes("This content was included from a shared file."),
        "database content should contain expanded include",
      );
      assert.ok(
        row.content.includes("[Contact us](/contact/)"),
        "database content should contain expanded nested data path",
      );
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

describe("eleventy-plugin-mdlite with header", () => {
  const headerOutputDir = join(fixturesDir, "_site_header");

  before(async () => {
    await rm(headerOutputDir, { recursive: true, force: true });

    const elev = new Eleventy(inputDir, headerOutputDir, {
      configPath: join(fixturesDir, "eleventy.config.header.js"),
      quietMode: true,
    });
    await elev.write();
  });

  after(async () => {
    await rm(headerOutputDir, { recursive: true, force: true });
  });

  it("prepends header to markdown output files", async () => {
    const content = await readFile(join(headerOutputDir, "index.md"), "utf8");
    assert.ok(
      content.startsWith("<!-- Generated by mdlite -->"),
      "output should start with header",
    );
  });

  it("prepends header to nested markdown files", async () => {
    const content = await readFile(
      join(headerOutputDir, "docs/foo.md"),
      "utf8",
    );
    assert.ok(
      content.startsWith("<!-- Generated by mdlite -->"),
      "nested output should start with header",
    );
  });

  it("inserts a newline between header and content", async () => {
    const content = await readFile(join(headerOutputDir, "index.md"), "utf8");
    assert.ok(
      content.startsWith("<!-- Generated by mdlite -->\n"),
      "header should be followed by a newline",
    );
  });

  it("does not include header in sqlite content", () => {
    const db = new Database(join(headerOutputDir, "sqlite.db"), {
      readonly: true,
    });
    try {
      const row = db
        .prepare("SELECT content FROM pages WHERE path = ?")
        .get("/");
      assert.ok(
        !row.content.includes("<!-- Generated by mdlite -->"),
        "database content should not contain header",
      );
    } finally {
      db.close();
    }
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
