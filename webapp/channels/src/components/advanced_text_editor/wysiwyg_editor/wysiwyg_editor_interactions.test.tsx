// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act} from '@testing-library/react';
import type {Editor} from '@tiptap/react';
import React, {useState} from 'react';

import {renderWithContext} from 'tests/react_testing_utils';
import {postMessageOnKeyPress} from 'utils/post_utils';

import WysiwygEditor from './wysiwyg_editor';
import type {WysiwygEditorHandle} from './wysiwyg_editor';
import {serializeToMarkdown} from './wysiwyg_markdown';

const press = (editor: Editor, key: string, init: KeyboardEventInit = {}) => act(() => {
    const event = new KeyboardEvent('keydown', {key, cancelable: true, ...init});
    editor.view.someProp('handleKeyDown', (handler) => handler(editor.view, event));
});

const typeText = (editor: Editor, text: string) => act(() => {
    editor.view.dispatch(editor.state.tr.insertText(text));
});

const pasteText = (editor: Editor, text: string, data: Record<string, string> = {}) => {
    const clipboard: Record<string, string> = {'text/plain': text, ...data};
    const event = {
        preventDefault: jest.fn(),
        clipboardData: {getData: (type: string) => clipboard[type] ?? '', files: []},
    } as unknown as ClipboardEvent;

    let handled = false;
    act(() => {
        handled = Boolean(editor.view.someProp('handlePaste', (handlePaste) => handlePaste(editor.view, event, editor.state.doc.slice(0))));
    });
    return handled;
};

const endOfText = (editor: Editor, text: string) => {
    let pos = -1;
    editor.state.doc.descendants((node, nodePos) => {
        if (node.isText && node.text === text) {
            pos = nodePos + text.length;
        }
    });
    return pos;
};

const baseProps = {
    onChange: jest.fn(),
    onSubmit: jest.fn(),
};

describe('WysiwygEditor interactions', () => {
    beforeAll(() => {
        document.elementFromPoint = () => null;
    });

    const renderEditor = (value: string, channelId = 'c1') => {
        const ref = React.createRef<WysiwygEditorHandle>();
        const utils = renderWithContext(
            <WysiwygEditor
                ref={ref}
                {...baseProps}
                value={value}
                channelId={channelId}
            />,
        );
        return {...utils, ref, editor: ref.current!.getEditor()!};
    };

    describe('Shift+Enter inside a quote', () => {
        test('starts a new quoted line', () => {
            const {editor} = renderEditor('> my quote');
            act(() => {
                editor.commands.setTextSelection(endOfText(editor, 'my quote'));
            });

            press(editor, 'Enter', {shiftKey: true});
            typeText(editor, 'line two');

            expect(editor.getHTML()).toContain('<blockquote><p>my quote</p><p>line two</p></blockquote>');
        });

        test('leaves the quote when pressed on an empty quoted line', () => {
            const {editor} = renderEditor('> my quote');
            act(() => {
                editor.commands.setTextSelection(endOfText(editor, 'my quote'));
            });

            press(editor, 'Enter', {shiftKey: true});
            press(editor, 'Enter', {shiftKey: true});
            typeText(editor, 'below');

            expect(editor.getHTML()).toContain('<blockquote><p>my quote</p></blockquote><p>below</p>');
        });
    });

    test('pastes a full markdown sample with lists, task items and headings', () => {
        const {editor} = renderEditor('');
        const markdown = '1. first\n2. second\n\n## Tables\n\nhello *world*\n\n- [ ] todo\n- [x] done\n\n| a | b |\n| - | - |\n| 1 | 2 |';

        expect(pasteText(editor, markdown)).toBe(true);
        expect(editor.getHTML()).toContain('<h2 class="markdown__heading">Tables</h2>');
        expect(editor.getHTML()).toContain('<p>hello <em>world</em></p>');
        expect(editor.getHTML()).toContain('<p>[ ] todo</p>');
    });

    describe('code blocks', () => {
        test('a code block without a language stays plain and is sent without one', () => {
            const {editor} = renderEditor('');
            act(() => {
                editor.chain().setTextSelection(1).setCodeBlock().run();
            });
            typeText(editor, 'const a = 1;');

            expect(editor.view.dom.querySelector('[class^="hljs-"]')).toBeNull();
            expect(serializeToMarkdown(editor)).toMatch(/^```\nconst a = 1;\n```/);
        });

        test('pasting a fenced block creates a highlighted code block with its language', () => {
            const {editor} = renderEditor('');

            expect(pasteText(editor, '```js\nconst a = 1;\n```')).toBe(true);
            expect(editor.getJSON().content?.[0]).toMatchObject({type: 'codeBlock', attrs: {language: 'js'}});
            expect(editor.view.dom.querySelector('.hljs-keyword')).not.toBeNull();
        });

        test('pasting from VS Code into a code block without a language takes the VS Code language', () => {
            const {editor} = renderEditor('');
            act(() => {
                editor.chain().setTextSelection(1).setCodeBlock().run();
            });

            pasteText(editor, 'def greet(name):\n    print(name)', {'vscode-editor-data': JSON.stringify({mode: 'python'})});

            expect(editor.getAttributes('codeBlock').language).toBe('python');
        });

        test('pasting into a code block keeps a language the user chose', () => {
            const {editor} = renderEditor('');
            act(() => {
                editor.chain().setTextSelection(1).setCodeBlock({language: 'go'}).run();
            });

            pasteText(editor, 'def greet(name):\n    print(name)', {'vscode-editor-data': JSON.stringify({mode: 'python'})});

            expect(editor.getAttributes('codeBlock').language).toBe('go');
        });

        test.each([
            ['javascript', 'const a = 1;\nfunction f(x) {\n    return x;\n}', 'javascript'],
            ['typescriptreact', 'const view = (props: Props): number => {\n    const value: number = props.count;\n    return value;\n};', 'typescript'],
            ['yaml', '- name: build\n  run: make', 'yaml'],
        ])('pasting %s code from VS Code creates a code block posts can highlight', (mode, code, language) => {
            const {editor} = renderEditor('');

            expect(pasteText(editor, code, {'vscode-editor-data': JSON.stringify({mode})})).toBe(true);
            expect(editor.getJSON().content?.[0]).toMatchObject({type: 'codeBlock', attrs: {language}});
            expect(editor.view.dom.querySelector('pre [class^="hljs-"]')).not.toBeNull();
        });

        test('pasting markdown-like text inside a code block leaves it as code', () => {
            const {editor} = renderEditor('');
            act(() => {
                editor.chain().setTextSelection(1).setCodeBlock().run();
            });

            expect(pasteText(editor, '- item\n**bold**')).toBe(false);
        });
    });

    test('text typed after a link is not part of the link', () => {
        const {editor} = renderEditor('');
        act(() => {
            editor.commands.insertContent({type: 'text', text: 'https://mattermost.com', marks: [{type: 'link', attrs: {href: 'https://mattermost.com'}}]});
        });

        typeText(editor, ' hello');

        expect(editor.getHTML()).toMatch(/https:\/\/mattermost\.com<\/a> hello<\/p>/);
    });

    test('Enter after an unclosed fence typed as text adds a line instead of sending', () => {
        const {editor} = renderEditor('');
        typeText(editor, '``` - [ ] example');

        const draft = serializeToMarkdown(editor);
        const enter = {key: 'Enter', keyCode: 13} as React.KeyboardEvent;

        expect(draft).toBe('``` - [ ] example');
        expect(postMessageOnKeyPress(enter, draft, false, true, 0, 0, draft.length)).toEqual({allowSending: false});
    });

    test('Enter sends text typed just before it', () => {
        jest.useFakeTimers();
        const onSend = jest.fn();
        const ref = React.createRef<WysiwygEditorHandle>();
        const Composer = () => {
            const [message, setMessage] = useState('');
            return (
                <WysiwygEditor
                    ref={ref}
                    value={message}
                    onChange={setMessage}
                    onSubmit={() => onSend(message)}
                    channelId='c1'
                />
            );
        };
        renderWithContext(<Composer/>);
        const editor = ref.current!.getEditor()!;

        typeText(editor, 'x.fjfj');
        press(editor, 'Enter');

        expect(onSend).toHaveBeenCalledWith('x.fjfj');
        jest.useRealTimers();
    });

    test('sending keeps draft changes made after the last keystroke', () => {
        jest.useFakeTimers();
        const onSend = jest.fn();
        const ref = React.createRef<WysiwygEditorHandle>();
        let attachFile = () => {};
        const Composer = () => {
            const [draft, setDraft] = useState({message: '', files: 0});
            attachFile = () => setDraft({...draft, files: 1});
            return (
                <WysiwygEditor
                    ref={ref}
                    value={draft.message}
                    onChange={(message) => setDraft({...draft, message})}
                    onSubmit={() => onSend(draft)}
                    channelId='c1'
                />
            );
        };
        renderWithContext(<Composer/>);
        const editor = ref.current!.getEditor()!;

        typeText(editor, 'hello');
        act(() => attachFile());
        press(editor, 'Enter');

        expect(onSend).toHaveBeenCalledWith({message: 'hello', files: 1});
        jest.useRealTimers();
    });

    describe('switching channels', () => {
        const switchTo = (rerender: (ui: React.ReactElement) => void, ref: React.RefObject<WysiwygEditorHandle | null>, value: string, channelId: string) => {
            rerender(
                <WysiwygEditor
                    ref={ref}
                    {...baseProps}
                    value={value}
                    channelId={channelId}
                />,
            );
        };

        test('loads the draft of the channel being switched to', () => {
            const {editor, rerender, ref} = renderEditor('first channel', 'c1');

            switchTo(rerender, ref, 'second channel', 'c2');

            expect(editor.getHTML()).toBe('<p>second channel</p>');
        });

        test('does not carry formatting toggled in an empty composer over to the next channel', () => {
            const {editor, rerender, ref} = renderEditor('', 'c1');
            act(() => {
                editor.chain().setTextSelection(1).toggleBold().run();
            });
            expect(editor.state.storedMarks?.map((mark) => mark.type.name)).toEqual(['bold']);

            switchTo(rerender, ref, '', 'c2');
            act(() => {
                editor.commands.setTextSelection(1);
            });
            typeText(editor, 'hi');

            expect(editor.getHTML()).toBe('<p>hi</p>');
        });

        test('saves an edit still pending at the switch to the channel it was typed in', () => {
            jest.useFakeTimers();
            const onChangeC1 = jest.fn();
            const onChangeC2 = jest.fn();
            const ref = React.createRef<WysiwygEditorHandle>();
            const render = (onChange: jest.Mock, channelId: string, value: string) => (
                <WysiwygEditor
                    ref={ref}
                    onSubmit={jest.fn()}
                    onChange={onChange}
                    value={value}
                    channelId={channelId}
                />
            );
            const {rerender} = renderWithContext(render(onChangeC1, 'c1', ''));
            const editor = ref.current!.getEditor()!;
            act(() => {
                editor.commands.setTextSelection(1);
            });
            typeText(editor, 'typed in c1');

            rerender(render(onChangeC2, 'c2', ''));
            act(() => {
                jest.runAllTimers();
            });

            expect(onChangeC1).toHaveBeenCalledWith('typed in c1');
            expect(onChangeC2).not.toHaveBeenCalled();
            jest.useRealTimers();
        });

        test('loads the draft again when switching back to its channel', () => {
            const {editor, rerender, ref} = renderEditor('my draft', 'c1');

            switchTo(rerender, ref, '', 'c2');
            switchTo(rerender, ref, 'my draft', 'c1');

            expect(editor.getHTML()).toBe('<p>my draft</p>');
            expect(editor.state.selection.from).toBe(endOfText(editor, 'my draft'));
        });
    });

    describe('following the value', () => {
        test('puts the cursor at the end of a message opened for editing', () => {
            const {editor} = renderEditor('first line\n\nmy message');

            expect(editor.state.selection.from).toBe(endOfText(editor, 'my message'));
        });

        test('shows a message changed outside the editor, like an AI rewrite', () => {
            const {editor, rerender, ref} = renderEditor('typed text');

            rerender(
                <WysiwygEditor
                    ref={ref}
                    {...baseProps}
                    value='rewritten text'
                    channelId='c1'
                />,
            );

            expect(editor.getHTML()).toBe('<p>rewritten text</p>');
        });

        test('keeps the cursor in place when its own change comes back as the value', () => {
            jest.useFakeTimers();
            const onChange = jest.fn();
            const ref = React.createRef<WysiwygEditorHandle>();
            const render = (value: string) => (
                <WysiwygEditor
                    ref={ref}
                    onSubmit={jest.fn()}
                    onChange={onChange}
                    value={value}
                    channelId='c1'
                />
            );
            const {rerender} = renderWithContext(render(''));
            const editor = ref.current!.getEditor()!;
            act(() => {
                editor.commands.setTextSelection(1);
            });
            typeText(editor, 'hello');
            act(() => {
                editor.commands.setTextSelection(3);
                jest.runAllTimers();
            });

            rerender(render(onChange.mock.lastCall[0]));

            expect(editor.state.selection.from).toBe(3);
            jest.useRealTimers();
        });
    });

    describe('appendQuote', () => {
        test('quotes into an empty editor and leaves the caret after the quote', () => {
            const {ref, editor} = renderEditor('');

            act(() => {
                ref.current!.appendQuote('Diam sapien\npellentesque\n\nvestibulum');
            });
            typeText(editor, 'my reply');

            expect(serializeToMarkdown(editor)).toBe('> Diam sapien\n> pellentesque\n>\n> vestibulum\n\nmy reply');

            // The reply must not be typed into the last paragraph, which the editor hides while it's empty
            expect(editor.state.doc.lastChild!.type.name).toBe('paragraph');
            expect(editor.state.doc.lastChild!.content.size).toBe(0);
        });

        test('appends the quote after existing content', () => {
            const {ref, editor} = renderEditor('Hey there');

            act(() => {
                ref.current!.appendQuote('Diam sapien');
            });
            typeText(editor, 'my reply');

            expect(serializeToMarkdown(editor)).toBe('Hey there\n\n> Diam sapien\n\nmy reply');
            expect(editor.state.doc.lastChild!.content.size).toBe(0);
        });

        test('keeps the Markdown formatting of the quote', () => {
            const {ref, editor} = renderEditor('');

            act(() => {
                ref.current!.appendQuote('## Key Objectives\n\n* **Performance:** faster\n* Security\n\n```javascript\nconst a = 1;\n```');
            });

            expect(editor.getJSON().content?.[0]).toMatchObject({
                type: 'blockquote',
                content: [
                    {type: 'heading', attrs: {level: 2}},
                    {type: 'bulletList'},
                    {type: 'codeBlock', attrs: {language: 'javascript'}},
                ],
            });
        });

        test('does nothing for blank text', () => {
            const {ref, editor} = renderEditor('Hey there');

            act(() => {
                ref.current!.appendQuote('  \n ');
            });

            expect(serializeToMarkdown(editor)).toBe('Hey there');
        });
    });
});
