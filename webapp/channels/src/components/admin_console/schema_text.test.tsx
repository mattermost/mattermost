// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import SchemaText from './schema_text';

describe('SchemaText', () => {
    const baseProps = {
        isMarkdown: false,
        isTranslated: false,
        text: 'This is help text',
    };

    test('should open external markdown links in the new window', () => {
        const props = {
            ...baseProps,
            isMarkdown: true,
            text: 'This is [a link](https://example.com)',
        };

        const {container} = renderWithContext(<SchemaText {...props}/>);

        const span = container.querySelector('span');
        expect(span).toHaveProperty('innerHTML', 'This is <a href="https://example.com" rel="noopener noreferrer" target="_blank">a link</a>');
    });

    test('should open internal markdown links in the same window', () => {
        const props = {
            ...baseProps,
            isMarkdown: true,
            text: 'This is [a link](http://localhost:8065/api/v4/users/src_id)',
        };

        const {container} = renderWithContext(<SchemaText {...props}/>);

        const span = container.querySelector('span');
        expect(span).toHaveProperty('innerHTML', 'This is <a href="http://localhost:8065/api/v4/users/src_id">a link</a>');
    });

    test('should support explicit external links like FormattedMarkdownMessage', () => {
        const props = {
            ...baseProps,
            isMarkdown: true,
            text: 'This is [a link](!https://example.com)',
        };

        const {container} = renderWithContext(<SchemaText {...props}/>);

        const span = container.querySelector('span');
        expect(span).toHaveProperty('innerHTML', 'This is <a href="https://example.com" rel="noopener noreferrer" target="_blank">a link</a>');
    });
});
