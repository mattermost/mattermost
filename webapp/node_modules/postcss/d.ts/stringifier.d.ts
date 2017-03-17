import Node from './node';
declare class Stringifier {
    builder: Stringifier.Builder;
    constructor(builder?: Stringifier.Builder);
    stringify(node: Node, semicolon?: boolean): void;
    root(node: any): void;
    comment(node: any): void;
    decl(node: any, semicolon: any): void;
    rule(node: any): void;
    atrule(node: any, semicolon: any): void;
    body(node: any): void;
    block(node: any, start: any): void;
    raw(node: Node, own: string, detect?: string): any;
    rawSemicolon(root: any): any;
    rawEmptyBody(root: any): any;
    rawIndent(root: any): any;
    rawBeforeComment(root: any, node: any): any;
    rawBeforeDecl(root: any, node: any): any;
    rawBeforeRule(root: any): any;
    rawBeforeClose(root: any): any;
    rawBeforeOpen(root: any): any;
    rawColon(root: any): any;
    beforeAfter(node: any, detect: any): any;
    rawValue(node: any, prop: any): any;
}
declare module Stringifier {
    interface Builder {
        (str: string, node?: Node, str2?: string): void;
    }
}
export default Stringifier;
