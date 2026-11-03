// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {render} from 'tests/react_testing_utils';

import WrappedCodeLines from './wrapped_code_lines';

const rows = (html: string) => {
    const {container} = render(<WrappedCodeLines html={html}/>);
    return Array.from(container.querySelectorAll('.post-code__line-text'));
};

describe('components/WrappedCodeLines', () => {
    test('should split plain text on any line ending', () => {
        expect(rows('a\nb\r\nc\rd').map((row) => row.textContent)).toEqual(['a', 'b', 'c', 'd']);
    });

    test('should keep a trailing empty line like renderLineNumbers does', () => {
        expect(rows('a\n').map((row) => row.textContent)).toEqual(['a', '']);
    });

    test('should close and reopen spans that run across lines', () => {
        expect(rows('<span class="hljs-code">a\nb</span>\nc').map((row) => row.innerHTML)).toEqual([
            '<span class="hljs-code">a</span>',
            '<span class="hljs-code">b</span>',
            'c',
        ]);
    });

    test('should handle nested spans', () => {
        expect(rows('<span class="x"><span class="y">a\nb</span> c</span>').map((row) => row.innerHTML)).toEqual([
            '<span class="x"><span class="y">a</span></span>',
            '<span class="x"><span class="y">b</span> c</span>',
        ]);
    });

    test('should decode escaped text instead of reading it as markup', () => {
        const [row] = rows('&lt;b&gt;x&lt;/b&gt;');

        expect(row.textContent).toBe('<b>x</b>');
        expect(row.querySelector('b')).not.toBeInTheDocument();
    });

    test('should only ever render text and class-only spans', () => {
        const [row] = rows('<img src=x onerror="alert(1)"><span class="a" onclick="alert(1)" style="color:red">ok</span>');

        expect(row.innerHTML).toBe('<span class="a">ok</span>');
    });

    test('should not put line numbers in the text', () => {
        const {container} = render(<WrappedCodeLines html={'a\nb'}/>);

        expect(container.querySelector('code')?.textContent).toBe('ab');
    });
});
