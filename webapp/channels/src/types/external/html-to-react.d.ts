// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

declare module 'html-to-react' {
    interface Node {
        type: string;
        name: string;
        attribs: {
            type: string;
            checked: boolean;
            'data-edited-post-id': string;
            href: any;
            mentionAttrib: string | undefined;
            [attribute: string]: string;
        };
        parentNode: {
            type?: string;
            name?: string;
        };
    }

    interface ProcessingInstruction {
        replaceChildren?: boolean;
        shouldProcessNode: (node: Node) => boolean;
        processNode: (node: Node, children?: React.ReactChildren, index: number) => Fragment;
    }

    declare class Parser {
        constructor(options?: object);
        parse(html: string): () => any;
        parseWithInstructions(html: string, isValidNode: () => boolean, ProcessingInstructions?: ProcessingInstruction[]): any;
    }

    declare class ProcessNodeDefinitions {
        constructor(arg: React.ReactNode);
        processDefaultNode: (node: Node, children?: React.ReactChildren, index: number) => Fragment;
    }

    export {Node, ProcessingInstruction, Parser, ProcessNodeDefinitions};
}
