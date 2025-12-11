// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Mock monaco-editor since it has issues with jsdom
export const editor = {
    create: () => {},
    defineTheme: () => {},
    createModel: () => {},
    setModelLanguage: () => {},
    IStandaloneCodeEditor: () => {},
};

export const languages = {
    register: () => {},
    setMonarchTokensProvider: () => {},
    registerCompletionItemProvider: () => {},
};

export class Range {
    public startLineNumber: number;
    public startColumn: number;
    public endLineNumber: number;
    public endColumn: number;

    constructor(
        startLineNumber: number,
        startColumn: number,
        endLineNumber: number,
        endColumn: number,
    ) {
        this.startLineNumber = startLineNumber;
        this.startColumn = startColumn;
        this.endLineNumber = endLineNumber;
        this.endColumn = endColumn;
    }
}

export const MarkerSeverity = {
    Error: 8,
    Warning: 4,
    Info: 2,
    Hint: 1,
};

export const Uri = {
    parse: () => {},
};
