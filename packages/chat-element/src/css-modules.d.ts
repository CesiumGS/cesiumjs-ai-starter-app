declare module "*.module.css" {
  const classes: Record<string, string>;
  export default classes;
}

// SVG assets (e.g. from @stratakit/icons) resolve to their URL string under the
// bundler. Used with StrataKit's <Icon href={…} />.
declare module "*.svg" {
  const url: string;
  export default url;
}
