import Processor from './processor';
import * as postcss from './postcss';
import Root from './root';
export default class Result implements postcss.Result {
    /**
     * The Processor instance used for this transformation.
     */
    processor: Processor;
    /**
     * Contains the Root node after all transformations.
     */
    root: Root;
    /**
     * Options from the Processor#process(css, opts) or Root#toResult(opts) call
     * that produced this Result instance.
     */
    opts: postcss.ResultOptions;
    /**
     * A CSS string representing this Result's Root instance.
     */
    css: string;
    /**
     * An instance of the SourceMapGenerator class from the source-map library,
     * representing changes to the Result's Root instance.
     * This property will have a value only if the user does not want an inline
     * source map. By default, PostCSS generates inline source maps, written
     * directly into the processed CSS. The map property will be empty by default.
     * An external source map will be generated — and assigned to map — only if
     * the user has set the map.inline option to false, or if PostCSS was passed
     * an external input source map.
     */
    map: postcss.ResultMap;
    /**
     * Contains messages from plugins (e.g., warnings or custom messages).
     * Add a warning using Result#warn() and get all warnings
     * using the Result#warnings() method.
     */
    messages: postcss.ResultMessage[];
    lastPlugin: postcss.Transformer;
    /**
     * Provides the result of the PostCSS transformations.
     */
    constructor(
        /**
         * The Processor instance used for this transformation.
         */
        processor?: Processor,
        /**
         * Contains the Root node after all transformations.
         */
        root?: Root,
        /**
         * Options from the Processor#process(css, opts) or Root#toResult(opts) call
         * that produced this Result instance.
         */
        opts?: postcss.ResultOptions);
    /**
     * Alias for css property.
     */
    toString(): string;
    /**
     * Creates an instance of Warning and adds it to messages.
     * @param message Used in the text property of the message object.
     * @param options Properties for Message object.
     */
    warn(message: string, options?: postcss.WarningOptions): void;
    /**
     * @returns Warnings from plugins, filtered from messages.
     */
    warnings(): postcss.ResultMessage[];
    /**
     * Alias for css property to use with syntaxes that generate non-CSS output.
     */
    content: string;
}
