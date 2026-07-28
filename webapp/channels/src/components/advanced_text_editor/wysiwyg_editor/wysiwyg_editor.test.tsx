// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Node} from '@tiptap/core';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

const mockCapturedConfig: {current: any} = {current: null};

jest.mock('@tiptap/react', () => {
    const ReactMock = require('react') as typeof import('react');
    return {
        __esModule: true,
        useEditor: (config: any) => {
            mockCapturedConfig.current = config;
            const base: any = {
                isDestroyed: false,
                isEmpty: true,
                commands: {
                    clearContent: () => undefined,
                    focus: () => undefined,
                    blur: () => undefined,
                    insertContent: () => undefined,
                },
                setEditable: () => undefined,
                getJSON: () => ({type: 'doc', content: [{type: 'paragraph', content: [{type: 'text', text: 'hi'}]}]}),
                view: {dom: globalThis.document.createElement('div')},
            };
            if (config?.contentType === 'markdown') {
                base.getMarkdown = () => 'hi';
            }
            return base;
        },
        EditorContent: () => ReactMock.createElement('div', {'data-testid': 'editor-content'}),
    };
});

jest.mock('./wysiwyg_suggestion_list', () => ({
    __esModule: true,
    default: () => null,
}));

import WysiwygEditor from './wysiwyg_editor';

const baseProps = {
    value: '',
    onChange: jest.fn(),
    onSubmit: jest.fn(),
    channelId: 'c1',
};

const extensionNames = (): string[] => (mockCapturedConfig.current?.extensions ?? []).map((e: any) => e.name || e.config?.name);

describe('WysiwygEditor', () => {
    beforeEach(() => {
        mockCapturedConfig.current = null;
        jest.clearAllMocks();
    });

    test('markdown mode (default) registers the Markdown extension', () => {
        renderWithContext(<WysiwygEditor {...baseProps}/>);

        expect(extensionNames()).toContain('markdown');
        expect(mockCapturedConfig.current?.contentType).toBe('markdown');
    });

    test('json mode omits the Markdown extension and drops the markdown contentType', () => {
        renderWithContext(
            <WysiwygEditor
                {...baseProps}
                contentType='json'
            />,
        );

        expect(extensionNames()).not.toContain('markdown');
        expect(mockCapturedConfig.current?.contentType).toBeUndefined();
    });

    test('extensions prop is appended to the built-in set at mount', () => {
        const CustomNode = Node.create({name: 'customNode', group: 'block'});

        renderWithContext(
            <WysiwygEditor
                {...baseProps}
                extensions={[CustomNode]}
            />,
        );

        const names = extensionNames();
        expect(names).toContain('customNode');
        expect(names).toContain('table'); // built-ins still present
    });

    test('onChange emits JSON in json mode', () => {
        jest.useFakeTimers();
        const onChange = jest.fn();

        renderWithContext(
            <WysiwygEditor
                {...baseProps}
                onChange={onChange}
                contentType='json'
            />,
        );

        mockCapturedConfig.current?.onUpdate?.({editor: {getJSON: () => ({type: 'doc', content: []}), getMarkdown: () => ''} as any});
        jest.runAllTimers();

        expect(onChange).toHaveBeenCalledWith(JSON.stringify({type: 'doc', content: []}));

        jest.useRealTimers();
    });

    test('onChange emits markdown in markdown mode', () => {
        jest.useFakeTimers();
        const onChange = jest.fn();

        renderWithContext(
            <WysiwygEditor
                {...baseProps}
                onChange={onChange}
            />,
        );

        mockCapturedConfig.current?.onUpdate?.({editor: {getJSON: () => ({}), getMarkdown: () => 'hello'} as any});
        jest.runAllTimers();

        expect(onChange).toHaveBeenCalledWith('hello');

        jest.useRealTimers();
    });

    test('json mode parses a JSON string value into an object for initial content', () => {
        const doc = {type: 'doc', content: [{type: 'paragraph'}]};

        renderWithContext(
            <WysiwygEditor
                {...baseProps}
                value={JSON.stringify(doc)}
                contentType='json'
            />,
        );

        expect(mockCapturedConfig.current?.content).toEqual(doc);
    });

    test('json mode falls back to an empty doc when value is not valid JSON', () => {
        renderWithContext(
            <WysiwygEditor
                {...baseProps}
                value='not json'
                contentType='json'
            />,
        );

        expect(mockCapturedConfig.current?.content).toEqual({type: 'doc', content: [{type: 'paragraph'}]});
    });

    test('json mode falls back to an empty doc when value parses to a non-object', () => {
        renderWithContext(
            <WysiwygEditor
                {...baseProps}
                value='"just a string"'
                contentType='json'
            />,
        );

        expect(mockCapturedConfig.current?.content).toEqual({type: 'doc', content: [{type: 'paragraph'}]});
    });

    test('markdown mode leaves enableContentCheck off', () => {
        renderWithContext(<WysiwygEditor {...baseProps}/>);

        expect(mockCapturedConfig.current?.enableContentCheck).toBe(false);
    });

    test('json mode enables enableContentCheck and forwards the callback', () => {
        const onContentError = jest.fn();

        renderWithContext(
            <WysiwygEditor
                {...baseProps}
                contentType='json'
                onContentError={onContentError}
            />,
        );

        expect(mockCapturedConfig.current?.enableContentCheck).toBe(true);

        const err = new Error('bad node');
        mockCapturedConfig.current?.onContentError?.({error: err});
        expect(onContentError).toHaveBeenCalledWith(err);
    });

    test('json mode reports a parse error via onContentError when value is unparseable', async () => {
        const onContentError = jest.fn();

        renderWithContext(
            <WysiwygEditor
                {...baseProps}
                value='not json'
                contentType='json'
                onContentError={onContentError}
            />,
        );

        expect(onContentError).toHaveBeenCalledTimes(1);
        expect(onContentError.mock.calls[0][0]).toBeInstanceOf(Error);
    });

    test('handlePaste short-circuits in json mode; markdown mode still handles pastes', () => {
        const mkEvent = () => ({
            preventDefault: jest.fn(),
            clipboardData: {
                getData: (type: string) => (type === 'text/plain' ? '# heading' : ''),
            },
        }) as any;

        renderWithContext(
            <WysiwygEditor
                {...baseProps}
                contentType='json'
            />,
        );
        expect(mockCapturedConfig.current?.editorProps?.handlePaste?.({} as any, mkEvent())).toBe(false);

        mockCapturedConfig.current = null;
        renderWithContext(<WysiwygEditor {...baseProps}/>);

        const result = mockCapturedConfig.current?.editorProps?.handlePaste?.({} as any, mkEvent());
        expect(result).toBe(true);
    });

    test('getEditor() on the handle returns the underlying Tiptap Editor instance', () => {
        const ref = React.createRef<React.ComponentRef<typeof WysiwygEditor>>();

        renderWithContext(
            <WysiwygEditor
                {...baseProps}
                ref={ref}
            />,
        );

        const editor = ref.current!.getEditor();
        expect(editor).not.toBeNull();
        expect(typeof (editor as any).getJSON).toBe('function');
    });

    test.each([
        ['null', 'null'],
        ['array', '[1,2,3]'],
        ['number', '42'],
    ])('json mode falls back to empty doc when value parses to %s', (_label, raw) => {
        const onContentError = jest.fn();

        renderWithContext(
            <WysiwygEditor
                {...baseProps}
                value={raw}
                contentType='json'
                onContentError={onContentError}
            />,
        );

        expect(mockCapturedConfig.current?.content).toEqual({type: 'doc', content: [{type: 'paragraph'}]});
        expect(onContentError).toHaveBeenCalledTimes(1);
    });

    test('json mode does not throw when consumer omits onContentError for a bad value', () => {
        expect(() => {
            renderWithContext(
                <WysiwygEditor
                    {...baseProps}
                    value='not json'
                    contentType='json'
                />,
            );
        }).not.toThrow();
    });

    test('handle.hasContentError() reflects load failure', async () => {
        const ref = React.createRef<React.ComponentRef<typeof WysiwygEditor>>();

        renderWithContext(
            <WysiwygEditor
                {...baseProps}
                value='not json'
                contentType='json'
                ref={ref}
            />,
        );

        expect(ref.current!.hasContentError()).toBe(true);
    });

    test('handle.hasContentError() is false after a clean json load', () => {
        const ref = React.createRef<React.ComponentRef<typeof WysiwygEditor>>();

        renderWithContext(
            <WysiwygEditor
                {...baseProps}
                value={JSON.stringify({type: 'doc', content: [{type: 'paragraph'}]})}
                contentType='json'
                ref={ref}
            />,
        );

        expect(ref.current!.hasContentError()).toBe(false);
    });
});
