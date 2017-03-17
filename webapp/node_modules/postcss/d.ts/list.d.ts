/**
 * Contains helpers for safely splitting lists of CSS values, preserving
 * parentheses and quotes.
 */
declare module List {
    /**
     * Safely splits space-separated values (such as those for background,
     * border-radius and other shorthand properties).
     */
    function space(str: string): string[];
    /**
     * Safely splits comma-separated values (such as those for transition-* and
     * background  properties).
     */
    function comma(str: string): string[];
}
export default List;
