import assert from "node:assert/strict";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import Database from "better-sqlite3";

/**
 * Recursively reads all .md files from a directory into a sorted object.
 * Returns { "relative/path.md": content }
 */
export async function readMarkdownFiles(dir) {
  const result = {};
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) {
      continue;
    }
    const fullPath = join(entry.parentPath, entry.name);
    const relPath = relative(dir, fullPath);
    result[relPath] = await readFile(fullPath, "utf8");
  }
  // Return sorted by key
  const sorted = {};
  for (const key of Object.keys(result).sort()) {
    sorted[key] = result[key];
  }
  return sorted;
}

/**
 * Opens a SQLite DB read-only and dumps the `pages` table.
 * Skips FTS virtual tables. Returns { pages: { columns: [...], rows: [...] } }
 */
export function dumpSqlite(dbPath) {
  const db = new Database(dbPath, { readonly: true });
  try {
    const columns = db.pragma("table_info(pages)").map((c) => c.name);
    const rows = db.prepare("SELECT * FROM pages ORDER BY path").all();
    return { pages: { columns, rows } };
  } finally {
    db.close();
  }
}

/**
 * Compares build output against snapshot files.
 * When UPDATE_SNAPSHOTS=1, writes actual output as new snapshots.
 */
export async function assertSnapshotsMatch(outputDir, snapshotDir) {
  const update = process.env.UPDATE_SNAPSHOTS === "1";

  // --- Markdown files ---
  const actualMd = await readMarkdownFiles(outputDir);
  const actualPaths = Object.keys(actualMd);

  if (update) {
    for (const [relPath, content] of Object.entries(actualMd)) {
      const snapPath = join(snapshotDir, relPath);
      await mkdir(join(snapPath, ".."), { recursive: true });
      await writeFile(snapPath, content);
    }
  } else {
    const expectedMd = await readMarkdownFiles(snapshotDir);
    const expectedPaths = Object.keys(expectedMd).filter((p) =>
      p.endsWith(".md"),
    );

    const missingInOutput = expectedPaths.filter(
      (p) => !actualPaths.includes(p),
    );
    const unexpectedInOutput = actualPaths.filter(
      (p) => !expectedPaths.includes(p),
    );

    if (missingInOutput.length > 0) {
      assert.fail(
        `Missing markdown files in output: ${missingInOutput.join(", ")}`,
      );
    }
    if (unexpectedInOutput.length > 0) {
      assert.fail(
        `Unexpected markdown files in output: ${unexpectedInOutput.join(", ")}`,
      );
    }

    for (const relPath of actualPaths) {
      assert.equal(
        actualMd[relPath],
        expectedMd[relPath],
        `Snapshot mismatch: ${relPath}`,
      );
    }
  }

  // --- SQLite databases ---
  const allEntries = await readdir(outputDir, {
    withFileTypes: true,
    recursive: true,
  });
  const dbFiles = allEntries
    .filter((e) => e.isFile() && e.name.endsWith(".db"))
    .map((e) => relative(outputDir, join(e.parentPath, e.name)));

  for (const dbRelPath of dbFiles) {
    const dbPath = join(outputDir, dbRelPath);
    const actual = dumpSqlite(dbPath);
    const snapJsonPath = join(snapshotDir, `${dbRelPath}.json`);

    if (update) {
      await mkdir(join(snapJsonPath, ".."), { recursive: true });
      await writeFile(snapJsonPath, `${JSON.stringify(actual, null, 2)}\n`);
    } else {
      const expected = JSON.parse(await readFile(snapJsonPath, "utf8"));
      assert.deepEqual(
        actual,
        expected,
        `SQLite snapshot mismatch: ${dbRelPath}`,
      );
    }
  }
}
