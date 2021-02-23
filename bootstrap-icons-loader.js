// <https://github.com/webpack/webpack/blob/911ec1aa67011e25aa1449610f5b0b557edd5459/lib/json/JsonParser.js#L8>
const parseJson = require('json-parse-better-errors');
const paths = require('path');

const SVG_CONTENT_EXTRACTION_REGEX = /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="16" height="16" fill="currentColor" class="bi bi-[a-z0-9-]+" viewBox="0 0 16 16">(.+)<\/svg>$/s;

/**
 * @this {import('@types/webpack').loader.LoaderContext}
 * @param {string} source
 */
module.exports = function bootstrapIconsLoader(source) {
  let callback = this.async();
  this.cacheable(true);

  let icon_requests = Object.keys(
    // Copied from <https://github.com/webpack/webpack/blob/911ec1aa67011e25aa1449610f5b0b557edd5459/lib/json/JsonParser.js#L39-L42>
    typeof source === 'object'
      ? source
      : parseJson(source[0] === '\ufeff' ? source.slice(1) : source),
  );

  this.resolve(this.context, 'bootstrap-icons/package.json', (err, icons_package_json_path) => {
    if (err != null) {
      callback(err);
      return;
    }

    let icons_dir = paths.join(paths.dirname(icons_package_json_path), 'icons');

    // Ah, the handling of good ol' Node callbacks fired in parallel...
    let completed_icon_requests = 0;
    let caught_error = false;
    let icons_data = {};

    for (let icon_name of icon_requests) {
      let icon_file = paths.join(icons_dir, `${icon_name}.svg`);
      this.addDependency(icon_file);

      // eslint-disable-next-line no-loop-func
      this.fs.readFile(icon_file, 'utf8', (err, icon_svg_content) => {
        if (caught_error) return;
        if (err != null) {
          caught_error = true;
          callback(err);
          return;
        }

        let match = icon_svg_content.match(SVG_CONTENT_EXTRACTION_REGEX);
        if (match == null) {
          throw new Error(`Failed to parse icon file ${icon_file}`);
        }
        let svg_content = match[1];
        icons_data[icon_name] = svg_content;

        completed_icon_requests++;
        if (completed_icon_requests === icon_requests.length) {
          callback(null, JSON.stringify(icons_data));
        }
      });
    }
  });
};
