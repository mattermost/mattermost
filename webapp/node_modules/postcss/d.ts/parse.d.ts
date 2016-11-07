import LazyResult from './lazy-result';
import * as postcss from './postcss';
import Result from './result';
import Root from './root';
/**
 * Parses source CSS.
 * @param css The CSS to parse.
 * @param options
 * @returns {} A new Root node, which contains the source CSS nodes.
 */
declare function parse(css: string | {
    toString(): string;
} | LazyResult | Result, options?: {
    from?: string;
    map?: postcss.SourceMapOptions;
}): Root;
declare module parse {
    var parse: postcss.Syntax | postcss.Parse;
}
export default parse;
