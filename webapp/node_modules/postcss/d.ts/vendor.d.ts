/**
 * Contains helpers for working with vendor prefixes.
 */
declare module Vendor {
    /**
     * @returns The vendor prefix extracted from the input string.
     */
    function prefix(prop: string): string;
    /**
     * @returns The input string stripped of its vendor prefix.
     */
    function unprefixed(prop: string): string;
}
export default Vendor;
