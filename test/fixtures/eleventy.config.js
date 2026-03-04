import mdlitePlugin from "../../index.js";

export default function (eleventyConfig) {
  eleventyConfig.addPairedShortcode("highlight", (content, lang) => {
    return `<pre><code class="${lang}">${content}</code></pre>`;
  });
  eleventyConfig.addFilter("fake_filter", (value) => value);
  eleventyConfig.addPlugin(mdlitePlugin);
}
