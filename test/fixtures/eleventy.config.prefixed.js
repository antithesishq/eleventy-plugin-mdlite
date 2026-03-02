import mdlitePlugin from "../../index.js";

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(mdlitePlugin, { pathPrefix: "docs" });
}
