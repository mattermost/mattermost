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

    test('should render plain text correctly', () => {
        const {container} = renderWithContext(<SchemaText {...baseProps}/>);

        expect(container).toMatchSnapshot();
    });

    test('should render markdown text correctly', () => {
        const props = {
            ...baseProps,
            isMarkdown: true,
            text: 'This is **HELP TEXT**',
        };

        const {container} = renderWithContext(<SchemaText {...props}/>);

        expect(container).toMatchSnapshot();
    });

    test('should render translated text correctly', () => {
        const props = {
            ...baseProps,
            isTranslated: true,
            text: {id: 'help.text', defaultMessage: 'This is {object}'},
            textValues: {
                object: 'help text',
            },
        };

        const {container} = renderWithContext(<SchemaText {...props}/>);

        expect(container).toMatchSnapshot();
    });

    test('should render translated markdown text correctly', () => {
        const props = {
            ...baseProps,
            isMarkdown: true,
            isTranslated: true,
            text: {id: 'help.text.markdown', defaultMessage: 'This is [{object}](https://example.com)'},
            textValues: {
                object: 'a help link',
            },
        };

        const {container} = renderWithContext(<SchemaText {...props}/>);

        expect(container).toMatchSnapshot();
    });

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
