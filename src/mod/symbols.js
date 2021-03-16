// Symbols are identifiers so unique that you can't access a property hidden
// behind the symbol even if you create another identically named symbol. That
// is, if you don't have access to the original symbol instance used to create
// the key in question. In my case, I use symbols to prevent any accidental
// conflicts with Localize Me or similar.
// P.S. Additionally they are invisble to the for-in loop.
// See also <https://developer.mozilla.org/en-US/docs/Glossary/Symbol>.

export const LangLabel_filePath = Symbol('LangLabel_filePath');
export const LangLabel_jsonPath = Symbol('LangLabel_jsonPath');
