// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import {MmBlocksFieldOpenContext} from './context';
import {FieldsBlock} from './fields_block';

jest.mock('components/markdown', () => ({
    __esModule: true,
    default: jest.fn((props: {message: string}) => (
        <div data-testid='markdown-mock'>{props.message}</div>
    )),
}));

jest.mock('components/external_link', () => ({
    __esModule: true,
    default: ({children, href, ...rest}: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
        <a
            href={href}
            data-testid='external-link'
            {...rest}
        >{children}</a>
    ),
}));

describe('FieldsBlock', () => {
    it('returns null when fields are empty', () => {
        const {container} = renderWithContext(
            <FieldsBlock
                block={{type: 'fields', fields: []}}
                postId='post-1'
            />,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('pairs two short fields into one row', () => {
        const {container} = renderWithContext(
            <FieldsBlock
                block={{
                    type: 'fields',
                    fields: [
                        {label: 'Left', value: 'A', short: true},
                        {label: 'Right', value: 'B', short: true},
                    ],
                }}
                postId='post-1'
            />,
        );

        expect(container.querySelector('.mm-blocks-fields__row--pair')).toBeInTheDocument();
        expect(container.querySelectorAll('.mm-blocks-fields__row')).toHaveLength(1);
        expect(screen.getByText('Left')).toBeInTheDocument();
        expect(screen.getByText('Right')).toBeInTheDocument();
    });

    it('renders an odd trailing short field as a single row', () => {
        const {container} = renderWithContext(
            <FieldsBlock
                block={{
                    type: 'fields',
                    fields: [
                        {label: 'Left', value: 'A', short: true},
                        {label: 'Right', value: 'B', short: true},
                        {label: 'Trail', value: 'C', short: true},
                    ],
                }}
                postId='post-1'
            />,
        );

        const rows = container.querySelectorAll('.mm-blocks-fields__row');
        expect(rows).toHaveLength(2);
        expect(rows[0]).toHaveClass('mm-blocks-fields__row--pair');
        expect(rows[1]).not.toHaveClass('mm-blocks-fields__row--pair');
        expect(screen.getByText('Trail')).toBeInTheDocument();
    });

    it('renders a hop button when type_id and onOpen are set', async () => {
        const onOpen = jest.fn();
        renderWithContext(
            <MmBlocksFieldOpenContext.Provider value={onOpen}>
                <FieldsBlock
                    block={{
                        type: 'fields',
                        fields: [{label: 'CVE', value: 'CVE-2024-1234', type_id: 'com.example:vuln'}],
                    }}
                    postId='post-1'
                />
            </MmBlocksFieldOpenContext.Provider>,
        );

        const button = screen.getByRole('button', {name: 'CVE-2024-1234'});
        expect(button).toHaveClass('mm-blocks-field__value--hop');
        await userEvent.click(button);
        expect(onOpen).toHaveBeenCalledWith({
            typeId: 'com.example:vuln',
            value: 'CVE-2024-1234',
            label: 'CVE',
        });
    });

    it('renders ExternalLink for https urls', () => {
        renderWithContext(
            <FieldsBlock
                block={{
                    type: 'fields',
                    fields: [{label: 'Link', value: 'Docs', url: 'https://example.com/docs'}],
                }}
                postId='post-1'
            />,
        );

        const link = screen.getByTestId('external-link');
        expect(link).toHaveAttribute('href', 'https://example.com/docs');
        expect(link).toHaveTextContent('Docs');
    });

    it('applies tone class on the value', () => {
        renderWithContext(
            <FieldsBlock
                block={{
                    type: 'fields',
                    fields: [{label: 'Score', value: '9.8', tone: 'danger'}],
                }}
                postId='post-1'
            />,
        );

        const value = screen.getByText('9.8');
        expect(value).toHaveAttribute('data-testid', 'markdown-mock');
        expect(value.parentElement).toHaveClass('mm-blocks-field__value--tone-danger');
    });

    it('renders field labels through Markdown', () => {
        renderWithContext(
            <FieldsBlock
                block={{
                    type: 'fields',
                    fields: [{label: '[Build](https://example.com/build)', value: 'ok'}],
                }}
                postId='post-1'
            />,
        );

        const label = screen.getByText('[Build](https://example.com/build)');
        expect(label).toHaveAttribute('data-testid', 'markdown-mock');
        expect(label.closest('.mm-blocks-field__label')).toBeInTheDocument();
    });
});
