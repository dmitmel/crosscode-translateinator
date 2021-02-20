const SVG_CONTENT_EXTRACTION_REGEX = /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="16" height="16" fill="currentColor" class="bi bi-[a-z0-9-]+" viewBox="0 0 16 16">(.+)<\/svg>$/s;

/**
 * @this {import('@types/webpack').loader.LoaderContext}
 * @param {string} source
 */
module.exports = function bootstrapIconsLoader(source) {
  this.cacheable(true);

  let match = source.match(SVG_CONTENT_EXTRACTION_REGEX);
  if (match == null) {
    throw new Error('Invalid icon file');
  }
  let svg_content = match[1];

  // The rest was copied from <https://github.com/webpack-contrib/raw-loader/blob/2c4d89150cfcbb521910fd3b7dbb8030ffabf30e/src/index.js#L14-L21>

  let json = JSON.stringify(svg_content)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  return `module.exports = ${json};`;
};
