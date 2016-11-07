import CssSyntaxError from './css-syntax-error';
import PreviousMap from './previous-map';
import LazyResult from './lazy-result';
import * as postcss from './postcss';
import Result from './result';
export default class Input implements postcss.Input {
    /**
     * The absolute path to the CSS source file defined with the "from" option.
     */
    file: string;
    /**
     * The unique ID of the CSS source. Used if "from" option is not provided
     * (because PostCSS does not know the file path).
     */
    id: string;
    /**
     * Represents the input source map passed from a compilation step before
     * PostCSS (e.g., from the Sass compiler).
     */
    map: PreviousMap;
    css: string;
    /**
     * Represents the source CSS.
     */
    constructor(css: string | {
        toString(): string;
    } | LazyResult | Result, opts?: {
        safe?: boolean | any;
        from?: string;
    });
    /**
     * The CSS source identifier. Contains input.file if the user set the "from"
     * option, or input.id if they did not.
     */
    from: string;
    error(message: string, line: number, column: number, opts?: {
        plugin?: string;
    }): CssSyntaxError;
    /**
     * Reads the input source map.
     * @returns A symbol position in the input source (e.g., in a Sass file
     * that was compiled to CSS before being passed to PostCSS):
     */
    origin(line: number, column: number): postcss.InputOrigin;
    private mapResolve(file);
}
