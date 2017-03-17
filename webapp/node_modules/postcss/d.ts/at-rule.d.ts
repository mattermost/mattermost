import Container from './container';
import * as postcss from './postcss';
export default class AtRule extends Container implements postcss.AtRule {
    /**
     * Returns a string representing the node's type. Possible values are
     * root, atrule, rule, decl or comment.
     */
    type: string;
    /**
     * Contains information to generate byte-to-byte equal node string as it
     * was in origin input.
     */
    raws: postcss.AtRuleRaws;
    /**
     * The identifier that immediately follows the @.
     */
    name: string;
    /**
     * These are the values that follow the at-rule's name, but precede any {}
     * block. The spec refers to this area as the at-rule's "prelude".
     */
    params: string;
    /**
     * Represents an at-rule. If it's followed in the CSS by a {} block, this
     * node will have a nodes property representing its children.
     */
    constructor(defaults?: postcss.AtRuleNewProps);
    /**
     * @param overrides New properties to override in the clone.
     * @returns A clone of this node. The node and its (cloned) children will
     * have a clean parent and code style properties.
     */
    clone(overrides?: Object): AtRule;
    toJSON(): postcss.JsonAtRule;
    append(...children: any[]): this;
    prepend(...children: any[]): this;
    afterName: string;
    _params: string;
}
