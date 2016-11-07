import Container from './container';
import CssSyntaxError from './css-syntax-error';
import * as postcss from './postcss';
import Result from './result';
export default class Node implements postcss.Node {
    /**
     * Returns a string representing the node's type. Possible values are
     * root, atrule, rule, decl or comment.
     */
    type: string;
    /**
     * Unique node ID
     */
    id: string;
    /**
     * Contains information to generate byte-to-byte equal node string as it
     * was in origin input.
     */
    raws: postcss.NodeRaws;
    /**
     * Returns the node's parent node.
     */
    parent: Container;
    /**
     * Returns the input source of the node. The property is used in source map
     * generation. If you create a node manually (e.g., with postcss.decl() ),
     * that node will not have a  source  property and will be absent from the
     * source map. For this reason, the plugin developer should consider cloning
     * nodes to create new ones (in which case the new node's source will
     * reference the original, cloned node) or setting the source property
     * manually.
     */
    source: postcss.NodeSource;
    constructor(defaults?: Object);
    /**
     * This method produces very useful error messages. If present, an input
     * source map will be used to get the original position of the source, even
     * from a previous compilation step (e.g., from Sass compilation).
     * @returns The original position of the node in the source, showing line
     * and column numbers and also a small excerpt to facilitate debugging.
     */
    error(
        /**
         * Error description.
         */
        message: string, options?: postcss.NodeErrorOptions): CssSyntaxError;
    /**
     * Creates an instance of Warning and adds it to messages. This method is
     * provided as a convenience wrapper for Result#warn.
     * Note that `opts.node` is automatically passed to Result#warn for you.
     * @param result The result that will receive the warning.
     * @param text Warning message. It will be used in the `text` property of
     * the message object.
     * @param opts Properties to assign to the message object.
     */
    warn(result: Result, text: string, opts?: postcss.WarningOptions): void;
    /**
     * Removes the node from its parent and cleans the parent property in the
     * node and its children.
     * @returns This node for chaining.
     */
    remove(): this;
    /**
     * @returns A CSS string representing the node.
     */
    toString(stringifier?: any): string;
    /**
     * @param overrides New properties to override in the clone.
     * @returns A clone of this node. The node and its (cloned) children will
     * have a clean parent and code style properties.
     */
    clone(overrides?: Object): Node;
    /**
     * Shortcut to clone the node and insert the resulting cloned node before
     * the current node.
     * @param overrides New Properties to override in the clone.
     * @returns The cloned node.
     */
    cloneBefore(overrides?: Object): Node;
    /**
     * Shortcut to clone the node and insert the resulting cloned node after
     * the current node.
     * @param overrides New Properties to override in the clone.
     * @returns The cloned node.
     */
    cloneAfter(overrides?: Object): Node;
    /**
     * Inserts node(s) before the current node and removes the current node.
     * @returns This node for chaining.
     */
    replaceWith(...nodes: (Node | Object)[]): this;
    /**
     * Removes the node from its current parent and inserts it at the end of
     * newParent. This will clean the before and after code style properties
     * from the node and replace them with the indentation style of newParent.
     * It will also clean the between property if newParent is in another Root.
     * @param newParent Where the current node will be moved.
     * @returns This node for chaining.
     */
    moveTo(newParent: Container): this;
    /**
     * Removes the node from its current parent and inserts it into a new
     * parent before otherNode. This will also clean the node's code style
     * properties just as it would in node.moveTo(newParent).
     * @param otherNode Will be after the current node after moving.
     * @returns This node for chaining.
     */
    moveBefore(otherNode: Node): this;
    /**
     * Removes the node from its current parent and inserts it into a new
     * parent after otherNode. This will also clean the node's code style
     * properties just as it would in node.moveTo(newParent).
     * @param otherNode Will be before the current node after moving.
     * @returns This node for chaining.
     */
    moveAfter(otherNode: Node): this;
    /**
     * @returns The next child of the node's parent; or, returns undefined if
     * the current node is the last child.
     */
    next(): Node;
    /**
     * @returns The previous child of the node's parent; or, returns undefined
     * if the current node is the first child.
     */
    prev(): Node;
    toJSON(): postcss.JsonNode;
    /**
     * @param prop Name or code style property.
     * @param defaultType Name of default value. It can be easily missed if the
     * value is the same as prop.
     * @returns A code style property value. If the node is missing the code
     * style property (because the node was manually built or cloned), PostCSS
     * will try to autodetect the code style property by looking at other nodes
     * in the tree.
     */
    raw(prop: string, defaultType?: string): any;
    /**
     * @returns The Root instance of the node's tree.
     */
    root(): any;
    cleanRaws(keepBetween?: boolean): void;
    positionInside(index: number): {
        line: number;
        column: number;
    };
    positionBy(options: any): {
        column: number;
        line: number;
    };
    /**
     * Deprecated. Use Node#remove.
     */
    removeSelf(): void;
    replace(nodes: any): this;
    style(prop: string, defaultType?: string): any;
    cleanStyles(keepBetween?: boolean): void;
    before: string;
    between: string;
}
