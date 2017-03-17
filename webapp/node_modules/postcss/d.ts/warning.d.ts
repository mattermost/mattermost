import * as postcss from './postcss';
import Node from './node';
export default class Warning implements postcss.Warning {
    /**
     * Contains the warning message.
     */
    text: string;
    /**
     * Returns a string representing the node's type. Possible values are
     * root, atrule, rule, decl or comment.
     */
    type: string;
    /**
     * Contains the name of the plugin that created this warning. When you
     * call Node#warn(), it will fill this property automatically.
     */
    plugin: string;
    /**
     * The CSS node that caused the warning.
     */
    node: Node;
    /**
     * The line in the input file with this warning's source.
     */
    line: number;
    /**
     * Column in the input file with this warning's source.
     */
    column: number;
    /**
     * Represents a plugin warning. It can be created using Node#warn().
     */
    constructor(
        /**
         * Contains the warning message.
         */
        text: string, options?: postcss.WarningOptions);
    /**
     * @returns Error position, message.
     */
    toString(): string;
}
