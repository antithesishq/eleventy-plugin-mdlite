import { rm } from "node:fs/promises";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import Eleventy from "@11ty/eleventy";
import { assertSnapshotsMatch } from "./snapshot.js";

const fixturesDir = new URL("./fixtures/", import.meta.url).pathname;
const snapshotsDir = new URL("./snapshots/", import.meta.url).pathname;
const inputDir = join(fixturesDir, "src");

describe("snapshots: default config", () => {
  const outputDir = join(fixturesDir, "_site_snap");

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

  it("markdown files match snapshots", async () => {
    await assertSnapshotsMatch(outputDir, join(snapshotsDir, "default"));
  });
});

describe("snapshots: header config", () => {
  const outputDir = join(fixturesDir, "_site_snap_header");

  before(async () => {
    await rm(outputDir, { recursive: true, force: true });
    const elev = new Eleventy(inputDir, outputDir, {
      configPath: join(fixturesDir, "eleventy.config.header.js"),
      quietMode: true,
    });
    await elev.write();
  });

  after(async () => {
    await rm(outputDir, { recursive: true, force: true });
  });

  it("markdown files match snapshots", async () => {
    await assertSnapshotsMatch(outputDir, join(snapshotsDir, "header"));
  });
});

describe("snapshots: prefixed config", () => {
  const outputDir = join(fixturesDir, "_site_snap_prefixed");

  before(async () => {
    await rm(outputDir, { recursive: true, force: true });
    const elev = new Eleventy(inputDir, outputDir, {
      configPath: join(fixturesDir, "eleventy.config.prefixed.js"),
      quietMode: true,
    });
    await elev.write();
  });

  after(async () => {
    await rm(outputDir, { recursive: true, force: true });
  });

  it("markdown files match snapshots", async () => {
    await assertSnapshotsMatch(outputDir, join(snapshotsDir, "prefixed"));
  });
});
