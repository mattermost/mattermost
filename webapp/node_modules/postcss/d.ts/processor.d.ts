import LazyResult from './lazy-result';
import * as postcss from './postcss';
import Result from './result';
export default class Processor implements postcss.Processor {
    /**
     * Contains the current version of PostCSS (e.g., "5.0.19").
     */
    version: '5.0.19';
    /**
     * Contains plugins added to this processor.
     */
    plugins: postcss.Plugin<any>[];
    constructor(plugins?: (typeof postcss.acceptedPlugin)[]);
    /**
     * Adds a plugin to be used as a CSS processor. Plugins can also be
     * added by passing them as arguments when creating a postcss instance.
     */
    use(plugin: typeof postcss.acceptedPlugin): this;
    /**
     * Parses source CSS. Because some plugins can be asynchronous it doesn't
     * make any transformations. Transformations will be applied in LazyResult's
     * methods.
     * @param css Input CSS or any object with toString() method, like a file
     * stream. If a Result instance is passed the processor will take the
     * existing Root parser from it.
     */
    process(css: string | {
        toString(): string;
    } | Result, options?: postcss.ProcessOptions): LazyResult;
    private normalize(plugins);
}
