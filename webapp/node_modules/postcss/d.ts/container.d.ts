import Comment from './comment';
import * as postcss from './postcss';
import AtRule from './at-rule';
import Node from './node';
import Rule from './rule';
/**
 * Containers can store any content. If you write a rule inside a rule,
 * PostCSS will parse it.
 */
export default class Container extends Node implements postcss.Container {
    private indexes;
    private lastEach;
    /**
     * Contains the container's children.
     */
    nodes: Node[];
    /**
     * @param overrides New properties to override in the clone.
     * @returns A clone of this node. The node and its (cloned) children will
     * have a clean parent and code style properties.
     */
    clone(overrides?: Object): any;
    toJSON(): postcss.JsonContainer;
    push(child: any): this;
    /**
     * Iterates through the container's immediate children, calling the
     * callback function for each child. If you need to recursively iterate
     * through all the container's descendant nodes, use container.walk().
     * Unlike the for {} -cycle or Array#forEach() this iterator is safe if you
     * are mutating the array of child nodes during iteration.
     * @param callback Iterator. Returning false will break iteration. Safe
     * if you are mutating the array of child nodes during iteration. PostCSS
     * will adjust the current index to match the mutations.
     */
    each(callback: (node: Node, index: number) => any): boolean | void;
    /**
     * Traverses the container's descendant nodes, calling `callback` for each
     * node. Like container.each(), this method is safe to use if you are
     * mutating arrays during iteration. If you only need to iterate through
     * the container's immediate children, use container.each().
     * @param callback Iterator.
     */
    walk(callback: (node: Node, index: number) => any): boolean | void;
    /**
     * Traverses the container's descendant nodes, calling `callback` for each
     * declaration. Like container.each(), this method is safe to use if you
     * are mutating arrays during iteration.
     * @param propFilter Filters declarations by property name. Only those
     * declarations whose property matches propFilter will be iterated over.
     * @param callback Called for each declaration node within the container.
     */
    walkDecls(propFilter: string | RegExp, callback?: (decl: postcss.Declaration, index: number) => any): boolean | void;
    walkDecls(callback: (decl: postcss.Declaration, index: number) => any): boolean | void;
    /**
     * Traverses the container's descendant nodes, calling `callback` for each
     * rule. Like container.each(), this method is safe to use if you are
     * mutating arrays during iteration.
     * @param selectorFilter Filters rules by selector. If provided, iteration
     * will only happen over rules that have matching names.
     * @param callback Iterator called for each rule node within the
     * container.
     */
    walkRules(selectorFilter: string | RegExp, callback: (atRule: Rule, index: number) => any): boolean | void;
    walkRules(callback: (atRule: Rule, index: number) => any): boolean | void;
    /**
     * Traverses the container's descendant nodes, calling `callback` for each
     * at-rule. Like container.each(), this method is safe to use if you are
     * mutating arrays during iteration.
     * @param nameFilter Filters at-rules by name. If provided, iteration will
     * only happen over at-rules that have matching names.
     * @param callback Iterator called for each at-rule node within the
     * container.
     */
    walkAtRules(nameFilter: string | RegExp, callback: (atRule: AtRule, index: number) => any): boolean | void;
    walkAtRules(callback: (atRule: AtRule, index: number) => any): boolean | void;
    /**
     * Traverses the container's descendant nodes, calling `callback` for each
     * commennt. Like container.each(), this method is safe to use if you are
     * mutating arrays during iteration.
     * @param callback Iterator called for each comment node within the container.
     */
    walkComments(callback: (comment: Comment, indexed: number) => any): void | boolean;
    /**
     * Inserts new nodes to the end of the container.
     * Because each node class is identifiable by unique properties, use the
     * following shortcuts to create nodes in insert methods:
     *     root.append({ name: '@charset', params: '"UTF-8"' }); // at-rule
     *     root.append({ selector: 'a' });                       // rule
     *     rule.append({ prop: 'color', value: 'black' });       // declaration
     *     rule.append({ text: 'Comment' })                      // comment
     * A string containing the CSS of the new element can also be used. This
     * approach is slower than the above shortcuts.
     *     root.append('a {}');
     *     root.first.append('color: black; z-index: 1');
     * @param nodes New nodes.
     * @returns This container for chaining.
     */
    append(...nodes: (Node | Object | string)[]): this;
    /**
     * Inserts new nodes to the beginning of the container.
     * Because each node class is identifiable by unique properties, use the
     * following shortcuts to create nodes in insert methods:
     *     root.prepend({ name: 'charset', params: '"UTF-8"' }); // at-rule
     *     root.prepend({ selector: 'a' });                       // rule
     *     rule.prepend({ prop: 'color', value: 'black' });       // declaration
     *     rule.prepend({ text: 'Comment' })                      // comment
     * A string containing the CSS of the new element can also be used. This
     * approach is slower than the above shortcuts.
     *     root.prepend('a {}');
     *     root.first.prepend('color: black; z-index: 1');
     * @param nodes New nodes.
     * @returns This container for chaining.
     */
    prepend(...nodes: (Node | Object | string)[]): this;
    cleanRaws(keepBetween?: boolean): void;
    /**
     * Insert newNode before oldNode within the container.
     * @param oldNode Child or child's index.
     * @returns This container for chaining.
     */
    insertBefore(oldNode: Node | number, newNode: Node | Object | string): this;
    /**
     * Insert newNode after oldNode within the container.
     * @param oldNode Child or child's index.
     * @returns This container for chaining.
     */
    insertAfter(oldNode: Node | number, newNode: Node | Object | string): this;
    /**
     * Removes the container from its parent and cleans the parent property in the
     * container and its children.
     * @returns This container for chaining.
     */
    remove(): any;
    /**
     * Removes child from the container and clean the parent properties from the
     * node and its children.
     * @param child Child or child's index.
     * @returns This container for chaining.
     */
    removeChild(child: Node | number): this;
    /**
     * Removes all children from the container and cleans their parent
     * properties.
     * @returns This container for chaining.
     */
    removeAll(): this;
    /**
     * Passes all declaration values within the container that match pattern
     * through the callback, replacing those values with the returned result of
     * callback. This method is useful if you are using a custom unit or
     * function and need to iterate through all values.
     * @param pattern Pattern that we need to replace.
     * @param options Options to speed up the search.
     * @param callbackOrReplaceValue String to replace pattern or callback
     * that will return a new value. The callback will receive the same
     * arguments as those passed to a function parameter of String#replace.
     */
    replaceValues(pattern: string | RegExp, options: {
        /**
         * Property names. The method will only search for values that match
         * regexp  within declarations of listed properties.
         */
        props?: string[];
        /**
         * Used to narrow down values and speed up the regexp search. Searching
         * every single value with a regexp can be slow. If you pass a fast
         * string, PostCSS will first check whether the value contains the fast
         * string; and only if it does will PostCSS check that value against
         * regexp. For example, instead of just checking for /\d+rem/ on all
         * values, set fast: 'rem' to first check whether a value has the rem
         * unit, and only if it does perform the regexp check.
         */
        fast?: string;
    }, callbackOrReplaceValue: string | {
        (substring: string, ...args: any[]): string;
    }): Container;
    replaceValues(pattern: string | RegExp, callbackOrReplaceValue: string | {
        (substring: string, ...args: any[]): string;
    }): Container;
    /**
     * Determines whether all child nodes satisfy the specified test.
     * @param callback A function that accepts up to three arguments. The
     * every method calls the callback function for each node until the
     * callback returns false, or until the end of the array.
     * @returns True if the callback returns true for all of the container's
     * children.
     */
    every(callback: (node: Node, index: number, nodes: Node[]) => any, thisArg?: any): boolean;
    /**
     * Determines whether the specified callback returns true for any child node.
     * @param callback A function that accepts up to three arguments. The some
     * method calls the callback for each node until the callback returns true,
     * or until the end of the array.
     * @param thisArg An object to which the this keyword can refer in the
     * callback function. If thisArg is omitted, undefined is used as the
     * this value.
     * @returns True if callback returns true for (at least) one of the
     * container's children.
     */
    some(callback: (node: Node, index: number, nodes: Node[]) => boolean, thisArg?: any): boolean;
    /**
     * @param child Child of the current container.
     * @returns The child's index within the container's "nodes" array.
     */
    index(child: Node | number): number;
    /**
     * @returns The container's first child.
     */
    first: Node;
    /**
     * @returns The container's last child.
     */
    last: Node;
    protected normalize(node: Node | string, sample?: Node, type?: string | boolean): Node[];
    protected normalize(props: postcss.AtRuleNewProps | postcss.RuleNewProps | postcss.DeclarationNewProps | postcss.CommentNewProps, sample?: Node, type?: string | boolean): Node[];
    rebuild(node: Node, parent?: Container): any;
    eachInside(callback: any): any;
    eachDecl(propFilter: any, callback?: any): any;
    eachRule(selectorFilter: any, callback?: any): any;
    eachAtRule(nameFilter: any, callback?: any): any;
    eachComment(selectorFilter: any, callback?: any): any;
    semicolon: boolean;
    after: string;
}
