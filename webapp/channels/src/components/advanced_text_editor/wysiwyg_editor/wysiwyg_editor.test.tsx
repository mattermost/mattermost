// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Node} from '@tiptap/core';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

const mockCapturedConfig: {current: any} = {current: null};

// Set to make the useEditor mock emit a contentError during construction,
// matching Tiptap's render-phase emit.
const mockConstructorError: {current: Error | null} = {current: null};

const mockChainCalls: {current: string[]} = {current: []};
const mockSetNodeThrows: {current: boolean} = {current: false};
const mockRunReturnsFalse: {current: boolean} = {current: false};

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

                chain: () => {
                    const link = (name: string) => () => {
                        mockChainCalls.current.push(name);
                        if (name === 'setNode' && mockSetNodeThrows.current) {
                            throw new RangeError('Invalid content for node type paragraph');
                        }
                        return chainStub;
                    };
                    const chainStub: any = {
                        focus: link('focus'),
                        splitBlock: link('splitBlock'),
                        setNode: link('setNode'),
                        run: () => {
                            mockChainCalls.current.push('run');
                            return !mockRunReturnsFalse.current;
                        },
                    };
                    return chainStub;
                },
            };

            // Mirrors the real library: getMarkdown is attached by the Markdown
            // extension's onBeforeCreate, not by the contentType option.
            const hasMarkdownExt = (config?.extensions ?? []).some((e: any) => (e.name || e.config?.name) === 'markdown');
            if (hasMarkdownExt) {
                base.getMarkdown = () => 'hi';
            }

            // Tiptap emits contentError synchronously inside the Editor
            // constructor, i.e. during render, and constructs only once per
            // mount. Consume the error so re-renders don't re-emit.
            if (mockConstructorError.current) {
                const error = mockConstructorError.current;
                mockConstructorError.current = null;
                config?.onContentError?.({error, editor: base, disableCollaboration: () => undefined});
            }
            return base;
        },
        EditorContent: () => ReactMock.createElement('div', {'data-testid': 'editor-content'}),
    };
});

jest.mock('./wysiwyg_suggestion_list', () => {
    const ReactMock = require('react') as typeof import('react');
    return {
        __esModule: true,
        default: () => ReactMock.createElement('div', {'data-testid': 'suggestion-list'}),
    };
});

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
        mockConstructorError.current = null;
        mockChainCalls.current = [];
        mockSetNodeThrows.current = false;
        mockRunReturnsFalse.current = false;
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.useRealTimers();
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
        expect(names).toContain('table'); // built-ins still present

        // Position matters: consumer extensions must come last so they can
        // override built-in nodes of the same name.
        expect(names.indexOf('customNode')).toBe(names.length - 1);
        expect(names.indexOf('customNode')).toBeGreaterThan(names.indexOf('markdown'));
    });

    test('extensions prop is appended in json mode too, where Markdown is absent', () => {
        const CustomNode = Node.create({name: 'customNode', group: 'block'});

        renderWithContext(
            <WysiwygEditor
                {...baseProps}
                contentType='json'
                extensions={[CustomNode]}
            />,
        );

        const names = extensionNames();
        expect(names).not.toContain('markdown');
        expect(names.indexOf('customNode')).toBe(names.length - 1);
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

    test('a post-mount content error forwards but does not latch hasContentError', () => {
        const onContentError = jest.fn();
        const ref = React.createRef<React.ComponentRef<typeof WysiwygEditor>>();

        renderWithContext(
            <WysiwygEditor
                {...baseProps}
                ref={ref}
                value='{"type":"doc","content":[]}'
                contentType='json'
                onContentError={onContentError}
            />,
        );

        expect(ref.current!.hasContentError()).toBe(false);

        const err = new Error('bad insert');
        mockCapturedConfig.current?.onContentError?.({error: err});

        expect(onContentError).toHaveBeenCalledWith(err);

        // Latching here would permanently stall a consumer's autosave loop that
        // started from a clean load.
        expect(ref.current!.hasContentError()).toBe(false);
    });

    test('a content error emitted during construction is deferred so a consumer can setState', () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        const seen: Array<Error | null> = [];
        const constructorError = new Error('schema mismatch');

        mockConstructorError.current = constructorError;

        // Models the real consumer: a parent that records the error in state.
        // If the editor emits during its own render, this setState happens while
        // rendering a different component and React logs an error.
        const Parent = () => {
            const [err, setErr] = React.useState<Error | null>(null);
            seen.push(err);
            return (
                <WysiwygEditor
                    {...baseProps}
                    value='{"type":"doc","content":[]}'
                    contentType='json'
                    onContentError={setErr}
                />
            );
        };

        renderWithContext(<Parent/>);

        expect(seen[seen.length - 1]).toBe(constructorError);
        expect(consoleError).not.toHaveBeenCalled();
        consoleError.mockRestore();
    });

    test('hasContentError latches when the initial load fails during construction', () => {
        const ref = React.createRef<React.ComponentRef<typeof WysiwygEditor>>();

        mockConstructorError.current = new Error('schema mismatch');

        renderWithContext(
            <WysiwygEditor
                {...baseProps}
                ref={ref}
                value='{"type":"doc","content":[]}'
                contentType='json'
            />,
        );

        expect(ref.current!.hasContentError()).toBe(true);
    });

    test('contentType is frozen at mount and ignores a later prop change', () => {
        const onChange = jest.fn();
        const {rerender} = renderWithContext(
            <WysiwygEditor
                {...baseProps}
                onChange={onChange}
                contentType='json'
            />,
        );

        rerender(
            <WysiwygEditor
                {...baseProps}
                onChange={onChange}
                contentType='markdown'
            />,
        );

        // Still json mode: paste stays short-circuited and updates stay JSON.
        expect(mockCapturedConfig.current?.editorProps?.handlePaste?.({}, {})).toBe(false);

        jest.useFakeTimers();
        mockCapturedConfig.current?.onUpdate?.({editor: {getJSON: () => ({type: 'doc'})}});
        jest.runAllTimers();

        expect(onChange).toHaveBeenCalledWith(JSON.stringify({type: 'doc'}));
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

    describe('readOnly', () => {
        const domAttributes = () => mockCapturedConfig.current?.editorProps?.attributes?.();

        test('an editable editor is a textbox that is not disabled', () => {
            renderWithContext(<WysiwygEditor {...baseProps}/>);

            expect(mockCapturedConfig.current?.editable).toBe(true);
            expect(domAttributes()).toMatchObject({role: 'textbox', 'aria-disabled': 'false'});
        });

        test('disabled is a textbox the user is locked out of', () => {
            const {container} = renderWithContext(
                <WysiwygEditor
                    {...baseProps}
                    disabled={true}
                />,
            );

            expect(mockCapturedConfig.current?.editable).toBe(false);
            expect(domAttributes()).toMatchObject({role: 'textbox', 'aria-disabled': 'true', 'data-disabled': 'true'});
            expect(container.querySelector('.WysiwygEditor--disabled')).not.toBeNull();
        });

        test('readOnly is content: not editable, and not announced as a control', () => {
            const {container} = renderWithContext(
                <WysiwygEditor
                    {...baseProps}
                    readOnly={true}
                />,
            );

            expect(mockCapturedConfig.current?.editable).toBe(false);

            const attributes = domAttributes();
            expect(attributes).not.toHaveProperty('role');
            expect(attributes).not.toHaveProperty('aria-disabled');
            expect(attributes).not.toHaveProperty('data-disabled');
            expect(container.querySelector('.WysiwygEditor--disabled')).toBeNull();
        });

        test('readOnly keeps an id addressable for callers that pass one', () => {
            renderWithContext(
                <WysiwygEditor
                    {...baseProps}
                    readOnly={true}
                    id='page-body'
                />,
            );

            expect(domAttributes()).toMatchObject({id: 'page-body', 'data-testid': 'page-body'});
        });

        test('readOnly wins over disabled, so a caller passing both gets content', () => {
            const {container} = renderWithContext(
                <WysiwygEditor
                    {...baseProps}
                    disabled={true}
                    readOnly={true}
                />,
            );

            expect(domAttributes()).not.toHaveProperty('aria-disabled');
            expect(container.querySelector('.WysiwygEditor--disabled')).toBeNull();
        });

        test('readOnly leaves out the suggestion list, which has nothing to complete', () => {
            const {queryByTestId, rerender} = renderWithContext(
                <WysiwygEditor
                    {...baseProps}
                    readOnly={true}
                />,
            );

            expect(queryByTestId('suggestion-list')).toBeNull();

            rerender(<WysiwygEditor {...baseProps}/>);
            expect(queryByTestId('suggestion-list')).not.toBeNull();
        });
    });

    describe('Enter inside a heading', () => {
        const headingView = () => ({
            state: {
                selection: {
                    $from: {
                        depth: 1,
                        node: () => ({type: {name: 'heading'}}),
                    },
                },
                schema: {nodes: {listItem: {}}},
            },
            dom: globalThis.document.createElement('div'),
            dispatch: jest.fn(),
        });

        const enterEvent = () => ({
            key: 'Enter',
            shiftKey: false,
            metaKey: false,
            ctrlKey: false,
            altKey: false,
            preventDefault: jest.fn(),
        });

        const pressEnter = () => {
            renderWithContext(<WysiwygEditor {...baseProps}/>);

            const event = enterEvent();
            const handled = mockCapturedConfig.current.editorProps.handleKeyDown(
                headingView() as any,
                event as unknown as KeyboardEvent,
            );

            return {handled, event};
        };

        test('exits the heading into a paragraph', () => {
            const {handled, event} = pressEnter();

            expect(handled).toBe(true);
            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockChainCalls.current).toEqual(['focus', 'splitBlock', 'setNode', 'run']);
        });

        test('falls back to a plain split when the paragraph conversion throws', () => {
            mockSetNodeThrows.current = true;

            const {handled, event} = pressEnter();

            expect(handled).toBe(true);
            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockChainCalls.current).toEqual([
                'focus', 'splitBlock', 'setNode',
                'focus', 'splitBlock', 'run',
            ]);
        });

        test('does not split a second time when run() reports failure', () => {
            mockRunReturnsFalse.current = true;

            const {handled} = pressEnter();

            expect(handled).toBe(true);
            expect(mockChainCalls.current).toEqual(['focus', 'splitBlock', 'setNode', 'run']);
        });
    });
});
