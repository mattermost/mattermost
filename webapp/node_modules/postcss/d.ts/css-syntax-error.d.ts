import * as postcss from './postcss';
export default class CssSyntaxError implements postcss.CssSyntaxError, SyntaxError {
    /**
     * Contains full error text in the GNU error format.
     */
    message: string;
    /**
     * Contains the source line of the error. PostCSS will use the input
     * source map to detect the original error location. If you wrote a
     * Sass file, compiled it to CSS and then parsed it with PostCSS,
     * PostCSS will show the original position in the Sass file. If you need
     * position in PostCSS input (e.g., to debug previous compiler), use
     * error.generated.line.
     */
    line: number;
    /**
     * Contains the source column of the error. PostCSS will use the input
     * source map to detect the original error location. If you wrote a
     * Sass file, compiled it to CSS and then parsed it with PostCSS,
     * PostCSS will show the original position in the Sass file. If you
     * need position in PostCSS input (e.g., to debug previous compiler),
     * use error.generated.column.
     */
    column: number;
    /**
     * Contains the source code of the broken file. PostCSS will use the
     * input source map to detect the original error location. If you wrote
     * a Sass file, compiled it to CSS and then parsed it with PostCSS,
     * PostCSS will show the original position in the Sass file. If you
     * need position in PostCSS input (e.g., to debug previous compiler),
     * use error.generated.source.
     */
    source: string;
    /**
     * If parser's from option is set, contains the absolute path to the
     * broken file. PostCSS will use the input source map to detect the
     * original error location. If you wrote a Sass file, compiled it
     * to CSS and then parsed it with PostCSS, PostCSS will show the
     * original position in the Sass file. If you need the position in
     * PostCSS input (e.g., to debug previous compiler), use
     * error.generated.file.
     */
    file: string;
    /**
     * Contains the PostCSS plugin name if the error didn't come from the
     * CSS parser.
     */
    plugin: string;
    name: string;
    /**
     * Contains only the error description.
     */
    reason: string;
    private columnNumber;
    private description;
    private lineNumber;
    private fileName;
    input: postcss.InputOrigin;
    /**
     * The CSS parser throws this error for broken CSS.
     */
    constructor(
        /**
         * Contains full error text in the GNU error format.
         */
        message: string,
        /**
         * Contains the source line of the error. PostCSS will use the input
         * source map to detect the original error location. If you wrote a
         * Sass file, compiled it to CSS and then parsed it with PostCSS,
         * PostCSS will show the original position in the Sass file. If you need
         * position in PostCSS input (e.g., to debug previous compiler), use
         * error.generated.line.
         */
        line?: number,
        /**
         * Contains the source column of the error. PostCSS will use the input
         * source map to detect the original error location. If you wrote a
         * Sass file, compiled it to CSS and then parsed it with PostCSS,
         * PostCSS will show the original position in the Sass file. If you
         * need position in PostCSS input (e.g., to debug previous compiler),
         * use error.generated.column.
         */
        column?: number,
        /**
         * Contains the source code of the broken file. PostCSS will use the
         * input source map to detect the original error location. If you wrote
         * a Sass file, compiled it to CSS and then parsed it with PostCSS,
         * PostCSS will show the original position in the Sass file. If you
         * need position in PostCSS input (e.g., to debug previous compiler),
         * use error.generated.source.
         */
        source?: string,
        /**
         * If parser's from option is set, contains the absolute path to the
         * broken file. PostCSS will use the input source map to detect the
         * original error location. If you wrote a Sass file, compiled it
         * to CSS and then parsed it with PostCSS, PostCSS will show the
         * original position in the Sass file. If you need the position in
         * PostCSS input (e.g., to debug previous compiler), use
         * error.generated.file.
         */
        file?: string,
        /**
         * Contains the PostCSS plugin name if the error didn't come from the
         * CSS parser.
         */
        plugin?: string);
    private setMessage();
    /**
     * @param color Whether arrow should be colored red by terminal color codes.
     * By default, PostCSS will use process.stdout.isTTY and
     * process.env.NODE_DISABLE_COLORS.
     * @returns A few lines of CSS source that caused the error. If CSS has
     * input source map without sourceContent this method will return an empty
     * string.
     */
    showSourceCode(color?: boolean): string;
    /**
     *
     * @returns Error position, message and source code of broken part.
     */
    toString(): string;
    generated: postcss.InputOrigin;
}
