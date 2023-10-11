// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {applyMarkdown} from './apply_markdown';

describe('applyMarkdown', () => {
    /* ***************
     * ORDERED LIST
     * ************** */

    test('should add ordered list to selected newline', () => {
        const value = 'brown\nfox jumps over lazy dog';
        const result = applyMarkdown({
            message: value,
            selectionStart: 5,
            selectionEnd: 6,
            markdownMode: 'ol',
        });

        expect(result).toEqual({
            message: '1. brown\n2. fox jumps over lazy dog',
            selectionStart: 8,
            selectionEnd: 12,
        });
    });

    test('should add ordered list', () => {
        const value = 'brown\nfox jumps over lazy dog';
        const result = applyMarkdown({
            message: value,
            selectionStart: 0,
            selectionEnd: 10,
            markdownMode: 'ol',
        });

        expect(result).toEqual({
            message: '1. brown\n2. fox jumps over lazy dog',
            selectionStart: 3,
            selectionEnd: 16,
        });
    });

    test('should remove ordered list', () => {
        const value = '0. brown\n1. fox jumps over lazy dog';
        const result = applyMarkdown({
            message: value,
            selectionStart: 0,
            selectionEnd: 0,
            markdownMode: 'ol',
        });

        expect(result).toEqual({
            message: 'brown\n1. fox jumps over lazy dog',
            selectionStart: 0,
            selectionEnd: 0,
        });
    });

    test('should remove ordered list', () => {
        // '0. brown\n2. f'
        const value = '0. brown\n1. fox jumps over lazy dog';
        const result = applyMarkdown({
            message: value,
            selectionStart: 0,
            selectionEnd: 13,
            markdownMode: 'ol',
        });

        expect(result).toEqual({
            message: 'brown\nfox jumps over lazy dog',
            selectionStart: 0,
            selectionEnd: 7,
        });
    });

    /* ***************
     * UNORDERED LIST
     * ************** */

    test('should apply unordered list', () => {
        const value = 'brown fox jumps over lazy dog';
        const result = applyMarkdown({
            message: value,
            selectionStart: 0,
            selectionEnd: 0,
            markdownMode: 'ul',
        });

        expect(result).toEqual({
            message: '- ' + value,
            selectionStart: 2,
            selectionEnd: 2,
        });
    });

    test('should remove markdown, and not remove text similar to markdown signs from the string content', () => {
        const value = '- brown fox - jumps - over lazy dog';
        const result = applyMarkdown({
            message: value,
            selectionStart: 0,
            selectionEnd: 0,
            markdownMode: 'ul',
        });

        expect(result).toEqual({
            message: value.substring(2),
            selectionStart: 0,
            selectionEnd: 0,
        });
    });

    test('should remove markdown, and not remove text similar to markdown signs from the string content', () => {
        const value = '- brown fox - jumps - over lazy dog';
        const result = applyMarkdown({
            message: value,
            selectionStart: 0,
            selectionEnd: 0,
            markdownMode: 'ul',
        });

        expect(result).toEqual({
            message: value.substring(2),
            selectionStart: 0,
            selectionEnd: 0,
        });
    });

    /* ***************
     * HEADING
     * ************** */
    test('heading markdown: should apply header', () => {
        const value = 'brown fox jumps over lazy dog';
        const result = applyMarkdown({
            selectionStart: 0,
            selectionEnd: 10,
            message: value,
            markdownMode: 'heading',
        });

        expect(result).toEqual({
            message: '### ' + value,
            selectionStart: 4,
            selectionEnd: 14,
        });
    });

    test('heading markdown: should remove header', () => {
        const value = '### brown fox jumps over lazy dog';
        const result = applyMarkdown({
            selectionStart: 9,
            selectionEnd: 14,
            message: value,
            markdownMode: 'heading',
        });

        expect(result).toEqual({
            message: value.substring(4),
            selectionStart: 5,
            selectionEnd: 10,
        });
    });

    test('heading markdown: should add multiline headings', () => {
        const value = 'brown\nfox\njumps\nover lazy dog';
        const result = applyMarkdown({
            selectionStart: 8,
            selectionEnd: 15,
            message: value,
            markdownMode: 'heading',
        });

        expect(result).toEqual({
            message: 'brown\n### fox\n### jumps\nover lazy dog',
            selectionStart: 12,
            selectionEnd: 23,
        });
    });

    test('heading markdown: should remove multiline headings', () => {
        // 'x\n### jumps'
        const value = 'brown\n### fox\n### jumps\nover lazy dog';
        const result = applyMarkdown({
            selectionStart: 12,
            selectionEnd: 23,
            message: value,
            markdownMode: 'heading',
        });

        expect(result).toEqual({
            message: 'brown\nfox\njumps\nover lazy dog',
            selectionStart: 8,
            selectionEnd: 15,
        });
    });

    test('heading markdown: should remove multiline headings (selection includes first line)', () => {
        const value = '### brown\n### fox\n### jumps\nover lazy dog';
        const result = applyMarkdown({
            selectionStart: 1,
            selectionEnd: 23,
            message: value,
            markdownMode: 'heading',
        });

        expect(result).toEqual({
            message: 'brown\nfox\njumps\nover lazy dog',
            selectionStart: 0,
            selectionEnd: 11,
        });
    });

    test('heading markdown: should add multiline headings (selection starts with new line)', () => {
        // '\nfox\njump'
        const value = 'brown\nfox\njumps\nover lazy dog';
        const result = applyMarkdown({
            selectionStart: 5,
            selectionEnd: 14,
            message: value,
            markdownMode: 'heading',
        });

        expect(result).toEqual({
            message: '### brown\n### fox\n### jumps\nover lazy dog',
            selectionStart: 9,
            selectionEnd: 26,
        });
    });

    /* ***************
     * QUOTE
     * ************** */
    test('heading markdown: should apply quote', () => {
        const value = 'brown fox jumps over lazy dog';
        const result = applyMarkdown({
            selectionStart: 0,
            selectionEnd: 0,
            message: value,
            markdownMode: 'quote',
        });

        expect(result).toEqual({
            message: '> ' + value,
            selectionStart: 2,
            selectionEnd: 2,
        });
    });

    test('heading markdown: should apply quote', () => {
        const value = 'brown fox jumps over lazy dog';
        const result = applyMarkdown({
            selectionStart: 0,
            selectionEnd: 10,
            message: value,
            markdownMode: 'quote',
        });

        expect(result).toEqual({
            message: '> ' + value,
            selectionStart: 2,
            selectionEnd: 12,
        });
    });

    test('heading markdown: should remove quote', () => {
        const value = '> brown fox jumps over lazy dog';
        const result = applyMarkdown({
            selectionStart: 9,
            selectionEnd: 14,
            message: value,
            markdownMode: 'quote',
        });

        expect(result).toEqual({
            message: value.substring(2),
            selectionStart: 7,
            selectionEnd: 12,
        });
    });

    /* ***************
     * BOLD & ITALIC
     * ************** */
    test('applyMarkdown returns correct markdown for bold hotkey', () => {
        // "Fafda" is selected with ctrl + B hotkey
        const result = applyMarkdown({
            message: 'Jalebi Fafda & Sambharo',
            selectionStart: 7,
            selectionEnd: 12,
            markdownMode: 'bold',
        });

        expect(result).toEqual({
            message: 'Jalebi **Fafda** & Sambharo',
            selectionStart: 9,
            selectionEnd: 14,
        });
    });

    test('applyMarkdown returns correct markdown for undo bold', () => {
        // "Fafda" is selected with ctrl + B hotkey
        const result = applyMarkdown({
            message: 'Jalebi **Fafda** & Sambharo',
            selectionStart: 9,
            selectionEnd: 14,
            markdownMode: 'bold',
        });

        expect(result).toEqual({
            message: 'Jalebi Fafda & Sambharo',
            selectionStart: 7,
            selectionEnd: 12,
        });
    });

    test('applyMarkdown returns correct markdown for italic hotkey', () => {
        // "Fafda" is selected with ctrl + I hotkey
        const result = applyMarkdown({
            message: 'Jalebi Fafda & Sambharo',
            selectionStart: 7,
            selectionEnd: 12,
            markdownMode: 'italic',
        });

        expect(result).toEqual({
            message: 'Jalebi *Fafda* & Sambharo',
            selectionStart: 8,
            selectionEnd: 13,
        });
    });

    test('applyMarkdown returns correct markdown for undo italic', () => {
        // "Fafda" is selected with ctrl + I hotkey
        const result = applyMarkdown({
            message: 'Jalebi *Fafda* & Sambharo',
            selectionStart: 8,
            selectionEnd: 13,
            markdownMode: 'italic',
        });

        expect(result).toEqual({
            message: 'Jalebi Fafda & Sambharo',
            selectionStart: 7,
            selectionEnd: 12,
        });
    });

    test('applyMarkdown returns correct markdown for bold hotkey and empty', () => {
        // Nothing is selected with ctrl + B hotkey and caret is just before "Fafda"
        const result = applyMarkdown({
            message: 'Jalebi Fafda & Sambharo',
            selectionStart: 7,
            selectionEnd: 7,
            markdownMode: 'bold',
        });

        expect(result).toEqual({
            message: 'Jalebi ****Fafda & Sambharo',
            selectionStart: 9,
            selectionEnd: 9,
        });
    });

    test('applyMarkdown returns correct markdown for italic hotkey and empty', () => {
        // Nothing is selected with ctrl + I hotkey and caret is just before "Fafda"
        const result = applyMarkdown({
            message: 'Jalebi Fafda & Sambharo',
            selectionStart: 7,
            selectionEnd: 7,
            markdownMode: 'italic',
        });

        expect(result).toEqual({
            message: 'Jalebi **Fafda & Sambharo',
            selectionStart: 8,
            selectionEnd: 8,
        });
    });

    test('applyMarkdown returns correct markdown for italic with bold', () => {
        // "Fafda" is selected with ctrl + I hotkey
        const result = applyMarkdown({
            message: 'Jalebi **Fafda** & Sambharo',
            selectionStart: 9,
            selectionEnd: 14,
            markdownMode: 'italic',
        });

        expect(result).toEqual({
            message: 'Jalebi ***Fafda*** & Sambharo',
            selectionStart: 10,
            selectionEnd: 15,
        });
    });

    test('applyMarkdown returns correct markdown for bold with italic', () => {
        // "Fafda" is selected with ctrl + B hotkey
        const result = applyMarkdown({
            message: 'Jalebi *Fafda* & Sambharo',
            selectionStart: 8,
            selectionEnd: 13,
            markdownMode: 'bold',
        });

        expect(result).toEqual({
            message: 'Jalebi ***Fafda*** & Sambharo',
            selectionStart: 10,
            selectionEnd: 15,
        });
    });

    test('applyMarkdown returns correct markdown for bold with italic+bold', () => {
        // "Fafda" is selected with ctrl + B hotkey
        const result = applyMarkdown({
            message: 'Jalebi ***Fafda*** & Sambharo',
            selectionStart: 10,
            selectionEnd: 15,
            markdownMode: 'bold',
        });

        // Should undo bold
        expect(result).toEqual({
            message: 'Jalebi *Fafda* & Sambharo',
            selectionStart: 8,
            selectionEnd: 13,
        });
    });

    test('applyMarkdown returns correct markdown for italic with italic+bold', () => {
        // "Fafda" is selected with ctrl + I hotkey
        const result = applyMarkdown({
            message: 'Jalebi ***Fafda*** & Sambharo',
            selectionStart: 10,
            selectionEnd: 15,
            markdownMode: 'italic',
        });

        // Should undo italic
        expect(result).toEqual({
            message: 'Jalebi **Fafda** & Sambharo',
            selectionStart: 9,
            selectionEnd: 14,
        });
    });
});
