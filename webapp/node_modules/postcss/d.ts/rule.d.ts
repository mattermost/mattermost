import Container from './container';
import * as postcss from './postcss';
export default class Rule extends Container implements postcss.Rule {
    /**
     * Returns a string representing the node's type. Possible values are
     * root, atrule, rule, decl or comment.
     */
    type: string;
    /**
     * Contains information to generate byte-to-byte equal node string as it
     * was in origin input.
     */
    raws: postcss.RuleRaws;
    /**
     * The rule's full selector. If there are multiple comma-separated selectors,
     * the entire group will be included.
     */
    selector: string;
    /**
     * Represents a CSS rule: a selector followed by a declaration block.
     */
    constructor(defaults?: postcss.RuleNewProps);
    /**
     * @param overrides New properties to override in the clone.
     * @returns A clone of this node. The node and its (cloned) children will
     * have a clean parent and code style properties.
     */
    clone(overrides?: Object): Rule;
    toJSON(): postcss.JsonRule;
    /**
     * @returns An array containing the rule's individual selectors.
     * Groups of selectors are split at commas.
     */
    selectors: string[];
    _selector: string;
}
