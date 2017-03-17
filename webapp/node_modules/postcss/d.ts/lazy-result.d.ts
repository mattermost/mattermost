import Processor from './processor';
import * as postcss from './postcss';
import Result from './result';
import Root from './root';
export default class LazyResult implements postcss.LazyResult {
    private stringified;
    private processed;
    private result;
    private error;
    private plugin;
    private processing;
    /**
     * A promise proxy for the result of PostCSS transformations.
     */
    constructor(processor: Processor,
        /**
         * String with input CSS or any object with toString() method, like a Buffer.
         * Optionally, send Result instance and the processor will take the existing
         * [Root] parser from it.
         */
        css: string | {
        toString(): string;
    } | LazyResult | Result, opts?: postcss.ProcessOptions);
    /**
     * @returns A processor used for CSS transformations.
     */
    processor: Processor;
    /**
     * @returns Options from the Processor#process(css, opts) call that produced
     * this Result instance.
     */
    opts: postcss.ResultOptions;
    /**
     * Processes input CSS through synchronous plugins and converts Root to a
     * CSS string. This property will only work with synchronous plugins. If
     * the processor contains any asynchronous plugins it will throw an error.
     * In this case, you should use LazyResult#then() instead.
     */
    css: string;
    /**
     * Alias for css property to use when syntaxes generate non-CSS output.
     */
    content: string;
    /**
     * Processes input CSS through synchronous plugins. This property will
     * only work with synchronous plugins. If the processor contains any
     * asynchronous plugins it will throw an error. In this case, you should
     * use LazyResult#then() instead.
     */
    map: postcss.ResultMap;
    /**
     * Processes input CSS through synchronous plugins. This property will only
     * work with synchronous plugins. If the processor contains any asynchronous
     * plugins it will throw an error. In this case, you should use
     * LazyResult#then() instead.
     */
    root: Root;
    /**
     * Processes input CSS through synchronous plugins. This property will only
     * work with synchronous plugins. If the processor contains any asynchronous
     * plugins it will throw an error. In this case, you should use
     * LazyResult#then() instead.
     */
    messages: postcss.ResultMessage[];
    /**
     * Processes input CSS through synchronous plugins and calls Result#warnings().
     * This property will only work with synchronous plugins. If the processor
     * contains any asynchronous plugins it will throw an error. In this case, you
     * You should use LazyResult#then() instead.
     */
    warnings(): postcss.ResultMessage[];
    /**
     * Alias for css property.
     */
    toString(): string;
    /**
     * Processes input CSS through synchronous and asynchronous plugins.
     * @param onRejected Called if any plugin throws an error.
     */
    then(onFulfilled: (result: Result) => void, onRejected?: (error: Error) => void): Function | any;
    /**
     * Processes input CSS through synchronous and asynchronous plugins.
     * @param onRejected Called if any plugin throws an error.
     */
    catch(onRejected: (error: Error) => void): Function | any;
    private handleError(error, plugin);
    private asyncTick(resolve, reject);
    private async();
    sync(): Result;
    private run(plugin);
    stringify(): Result;
}
