import * as postcss from './postcss';
import Node from './node';
export default class Comment extends Node implements postcss.Comment {
    /**
     * Returns a string representing the node's type. Possible values are
     * root, atrule, rule, decl or comment.
     */
    type: string;
    /**
     * The comment's text.
     */
    text: string;
    /**
     * Represents a comment between declarations or statements (rule and at-rules).
     * Comments inside selectors, at-rule parameters, or declaration values will
     * be stored in the Node#raws properties.
     */
    constructor(defaults?: postcss.CommentNewProps);
    /**
     * @param overrides New properties to override in the clone.
     * @returns A clone of this node. The node and its (cloned) children will
     * have a clean parent and code style properties.
     */
    clone(overrides?: Object): any;
    toJSON(): postcss.JsonComment;
    left: string;
    right: string;
}
