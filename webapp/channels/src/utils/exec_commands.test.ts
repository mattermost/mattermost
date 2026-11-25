// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {applyMarkdown} from 'utils/markdown/apply_markdown';
import type {MarkdownMode} from 'utils/markdown/apply_markdown';

import {replaceTextboxValue} from './exec_commands';

describe('replaceTextboxValue', () => {
    let textbox: HTMLTextAreaElement;
    let execCommand: jest.SpyInstance;

    // JSDOM doesn't implement execCommand, so emulate how browsers apply it to the focused textbox's selection
    function emulateExecCommand(command: string, _showUI?: boolean, text = '') {
        const target = document.activeElement as HTMLTextAreaElement;
        target.setRangeText(command === 'delete' ? '' : text, target.selectionStart, target.selectionEnd, 'end');
        target.dispatchEvent(new Event('input', {bubbles: true}));
        return true;
    }

    beforeEach(() => {
        textbox = document.createElement('textarea');
        document.body.appendChild(textbox);
        execCommand = jest.spyOn(document, 'execCommand').mockImplementation(emulateExecCommand);
    });

    afterEach(() => {
        execCommand.mockRestore();
        textbox.remove();
    });

    function applyFormatting(message: string, selectionStart: number, selectionEnd: number, markdownMode: MarkdownMode) {
        textbox.value = message;
        const res = applyMarkdown({message, selectionStart, selectionEnd, markdownMode});
        return replaceTextboxValue(textbox, res.message);
    }

    test('should replace only the changed range when applying bold', () => {
        const replaced = applyFormatting('test writing post', 5, 12, 'bold');

        expect(replaced).toBe(true);
        expect(textbox.value).toBe('test **writing** post');
        expect(execCommand).toHaveBeenCalledTimes(1);
        expect(execCommand).toHaveBeenCalledWith('insertText', false, '**writing**');
    });

    test('should replace only the changed range when removing bold', () => {
        const replaced = applyFormatting('test **writing** post', 7, 14, 'bold');

        expect(replaced).toBe(true);
        expect(textbox.value).toBe('test writing post');
        expect(execCommand).toHaveBeenCalledWith('insertText', false, 'writing');
    });

    test('should insert a prefix when applying a heading', () => {
        const replaced = applyFormatting('my title', 0, 0, 'heading');

        expect(replaced).toBe(true);
        expect(textbox.value).toBe('### my title');
        expect(execCommand).toHaveBeenCalledWith('insertText', false, '### ');
    });

    test('should delete the prefix when removing a heading since there is no text to insert', () => {
        const replaced = applyFormatting('### my title', 4, 4, 'heading');

        expect(replaced).toBe(true);
        expect(textbox.value).toBe('my title');
        expect(execCommand).toHaveBeenCalledTimes(1);
        expect(execCommand).toHaveBeenCalledWith('delete');
    });

    test('should apply formatting across multiple lines in one edit', () => {
        const message = 'first\nsecond\nthird';
        const replaced = applyFormatting(message, 0, message.length, 'ul');

        expect(replaced).toBe(true);
        expect(textbox.value).toBe('- first\n- second\n- third');
        expect(execCommand).toHaveBeenCalledTimes(1);
    });

    test.each([
        ['**', '****'],
        ['****', '**'],
        ['aa', 'aaa'],
        ['aaa', 'aa'],
        ['hello', 'hello****'],
        ['', '****'],
        ['abc', ''],
    ])('should replace %p with %p in a single edit', (current, value) => {
        textbox.value = current;

        expect(replaceTextboxValue(textbox, value)).toBe(true);
        expect(textbox.value).toBe(value);
        expect(execCommand).toHaveBeenCalledTimes(1);
    });

    test('should do nothing when the value is unchanged', () => {
        textbox.value = 'unchanged';

        expect(replaceTextboxValue(textbox, 'unchanged')).toBe(true);
        expect(execCommand).not.toHaveBeenCalled();
    });

    test('should return false when the browser does not apply the edit', () => {
        execCommand.mockReturnValue(false);

        const replaced = applyFormatting('test writing post', 5, 12, 'bold');

        expect(replaced).toBe(false);
        expect(textbox.value).toBe('test writing post');
    });
});
