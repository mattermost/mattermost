import Stringifier from './stringifier';
import * as postcss from './postcss';
import Node from './node';
/**
 * Default function to convert a node tree into a CSS string.
 */
declare function stringify(node: Node, builder: Stringifier.Builder): void;
declare module stringify {
    var stringify: postcss.Syntax | postcss.Stringify;
}
export default stringify;
