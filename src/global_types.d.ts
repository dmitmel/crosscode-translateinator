// It is crucial that this file is not an ES module. In other words, it
// shouldn't contain any imports or exports.
declare module '*.scss';
declare module '*.svg' {
  const url: string;
  export default url;
}

declare namespace chrome {
  namespace runtime {
    function reload(): never;
  }
}
