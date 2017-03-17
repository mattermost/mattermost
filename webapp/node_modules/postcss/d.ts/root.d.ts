import PreviousMap from './previous-map';
import Container from './container';
import * as postcss from './postcss';
import Result from './result';
import Node from './node';
export default class Root extends Container implements postcss.Root {
    /**
     * Returns a string representing the node's type. Possible values are
     * root, atrule, rule, decl or comment.
     */
    type: string;
    rawCache: {
        [key: string]: any;
    };
    /**
     * Represents a CSS file and contains all its parsed nodes.
     */
    constructor(defaults?: postcss.RootNewProps);
    /**
     * @param overrides New properties to override in the clone.
     * @returns A clone of this node. The node and its (cloned) children will
     * have a clean parent and code style properties.
     */
    clone(overrides?: Object): Root;
    toJSON(): postcss.JsonRoot;
    /**
     * Removes child from the root node, and the parent properties of node and
     * its children.
     * @param child Child or child's index.
     * @returns This root node for chaining.
     */
    removeChild(child: Node | number): this;
    protected normalize(node: Node | string, sample: Node, type?: string): Node[];
    protected normalize(props: postcss.AtRuleNewProps | postcss.RuleNewProps | postcss.DeclarationNewProps | postcss.CommentNewProps, sample: Node, type?: string): Node[];
    /**
     * @returns A Result instance representing the root's CSS.
     */
    toResult(options?: {
        /**
         * The path where you'll put the output CSS file. You should always
         * set "to" to generate correct source maps.
         */
        to?: string;
        map?: postcss.SourceMapOptions;
    }): Result;
    /**
     * Deprecated. Use Root#removeChild.
     */
    remove(child?: Node | number): Root;
    /**
     * Deprecated. Use Root#source.input.map.
     */
    prevMap(): PreviousMap;
}
