// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen} from '@testing-library/react';

import {renderWithContext} from 'tests/react_testing_utils';
import SchemaText from './schema_text';

describe('SchemaText', () => {
    const baseProps = {
        isMarkdown: false,
        text: 'This is help text',
    };

    test('should render plain text correctly', () => {
        render(<SchemaText {...baseProps}/>);
        
        expect(screen.getByText('This is help text')).toBeInTheDocument();
    });

    test('should render markdown text correctly', () => {
        const props = {
            ...baseProps,
            isMarkdown: true,
            text: 'This is **HELP TEXT**',
        };

        render(<SchemaText {...props}/>);
        
        const element = screen.getByText(/This is/);
        expect(element).toBeInTheDocument();
        expect(element.innerHTML).toContain('<strong>HELP TEXT</strong>');
    });

    test('should render translated text correctly', () => {
        const props = {
            text: {id: 'help.text', defaultMessage: 'This is {object}'},
            textValues: {
                object: 'help text',
            },
        };

        renderWithContext(<SchemaText {...props}/>);
        
        expect(screen.getByText('This is help text')).toBeInTheDocument();
    });

    test('should render translated markdown text correctly', () => {
        const props = {
            isMarkdown: true,
            text: {id: 'help.text.markdown', defaultMessage: 'This is [{object}](https://example.com)'},
            textValues: {
                object: 'a help link',
            },
        };

        renderWithContext(<SchemaText {...props}/>);
        
        const link = screen.getByRole('link', {name: 'a help link'});
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute('href', 'https://example.com');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    test('should open external markdown links in the new window', () => {
        const props = {
            ...baseProps,
            isMarkdown: true,
            text: 'This is [a link](https://example.com)',
        };

        render(<SchemaText {...props}/>);
        
        // Find the link element
        const link = screen.getByRole('link', {name: 'a link'});
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute('href', 'https://example.com');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    test('should open internal markdown links in the same window', () => {
        const props = {
            ...baseProps,
            isMarkdown: true,
            text: 'This is [a link](http://localhost:8065/api/v4/users/src_id)',
        };

        render(<SchemaText {...props}/>);
        
        // Find the link element
        const link = screen.getByRole('link', {name: 'a link'});
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute('href', 'http://localhost:8065/api/v4/users/src_id');
        expect(link).not.toHaveAttribute('target', '_blank');
        expect(link).not.toHaveAttribute('rel', 'noopener noreferrer');
    });

    test('should support explicit external links like FormattedMarkdownMessage', () => {
        const props = {
            ...baseProps,
            isMarkdown: true,
            text: 'This is [a link](!https://example.com)',
        };

        render(<SchemaText {...props}/>);
        
        // Find the link element
        const link = screen.getByRole('link', {name: 'a link'});
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute('href', 'https://example.com');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
});
