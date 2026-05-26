// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {MmStaticSelectBlock} from '@mattermost/types/mm_blocks';
import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import {StaticSelectElement} from './static_select_element';

jest.mock('components/autocomplete_selector', () => ({
    __esModule: true,
    default: jest.fn((props: {
        value?: string;
        placeholder?: string;
        disabled?: boolean;
        onSelected?: (selected: {text: string; value: string}) => void;
    }) => (
        <div data-testid='autocomplete-mock'>
            <span data-testid='autocomplete-value'>{props.value}</span>
            <span data-testid='autocomplete-placeholder'>{props.placeholder}</span>
            <button
                type='button'
                data-testid='autocomplete-select'
                disabled={props.disabled}
                onClick={() => props.onSelected?.({text: 'Option B', value: 'b'})}
            >
                {'select'}
            </button>
        </div>
    )),
}));

describe('StaticSelectElement', () => {
    const onAction = jest.fn();
    const postId = 'post-select-1';

    beforeEach(() => {
        onAction.mockClear();
    });

    it('returns null when action_id is missing', () => {
        const {container} = renderWithContext(
            <StaticSelectElement
                element={{
                    type: 'static_select',
                    placeholder: 'Pick',
                    options: [{text: 'A', value: 'a'}],
                } as MmStaticSelectBlock}
                postId={postId}
                onAction={onAction}
            />,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('returns null when static options are empty and no dynamic data_source', () => {
        const {container} = renderWithContext(
            <StaticSelectElement
                element={{
                    type: 'static_select',
                    action_id: 'sel',
                    placeholder: 'Pick',
                    options: [],
                }}
                postId={postId}
                onAction={onAction}
            />,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('shows initial_option label when redux has no selection', () => {
        renderWithContext(
            <StaticSelectElement
                element={{
                    type: 'static_select',
                    action_id: 'sel',
                    placeholder: 'Choose',
                    options: [
                        {text: 'Option A', value: 'a'},
                        {text: 'Option B', value: 'b'},
                    ],
                    initial_option: 'b',
                }}
                postId={postId}
                onAction={onAction}
            />,
            {},
            {useMockedStore: true},
        );

        expect(screen.getByTestId('autocomplete-value')).toHaveTextContent('Option B');
    });

    it('prefers redux menuActions text over initial_option', () => {
        const state: DeepPartial<GlobalState> = {
            views: {
                posts: {
                    menuActions: {
                        [postId]: {
                            sel: {text: 'From Redux', value: 'redux'},
                        },
                    },
                },
            },
        };

        renderWithContext(
            <StaticSelectElement
                element={{
                    type: 'static_select',
                    action_id: 'sel',
                    placeholder: 'Choose',
                    options: [{text: 'Option A', value: 'a'}],
                    initial_option: 'a',
                }}
                postId={postId}
                onAction={onAction}
            />,
            state,
            {useMockedStore: true},
        );

        expect(screen.getByTestId('autocomplete-value')).toHaveTextContent('From Redux');
    });

    it('dispatches redux selection and onAction when an option is chosen', async () => {
        const user = userEvent.setup();
        const {store} = renderWithContext(
            <StaticSelectElement
                element={{
                    type: 'static_select',
                    action_id: 'sel',
                    placeholder: 'Choose',
                    options: [
                        {text: 'Option A', value: 'a'},
                        {text: 'Option B', value: 'b'},
                    ],
                    cookie: 'attach-cookie',
                }}
                postId={postId}
                onAction={onAction}
            />,
            {},
            {useMockedStore: false},
        );

        expect(screen.getByTestId('autocomplete-value')).toHaveTextContent('');

        await user.click(screen.getByTestId('autocomplete-select'));

        expect(onAction).toHaveBeenCalledWith('sel', 'b', undefined, 'attach-cookie');
        expect(store.getState().views.posts.menuActions[postId]).toEqual({
            sel: {text: 'Option B', value: 'b'},
        });
        expect(screen.getByTestId('autocomplete-value')).toHaveTextContent('Option B');
    });

    it('disables the select while onAction promise is pending', async () => {
        let resolveAction!: () => void;
        const onActionPending = jest.fn(() => new Promise<void>((resolve) => {
            resolveAction = resolve;
        }));
        const user = userEvent.setup();

        renderWithContext(
            <StaticSelectElement
                element={{
                    type: 'static_select',
                    action_id: 'sel',
                    placeholder: 'Choose',
                    options: [
                        {text: 'Option A', value: 'a'},
                        {text: 'Option B', value: 'b'},
                    ],
                }}
                postId={postId}
                onAction={onActionPending}
            />,
        );

        await user.click(screen.getByTestId('autocomplete-select'));

        expect(screen.getByTestId('autocomplete-select')).toBeDisabled();

        resolveAction();
        await screen.findByTestId('autocomplete-select');
        expect(screen.getByTestId('autocomplete-select')).not.toBeDisabled();
    });

    it('renders for users data_source without static options', () => {
        renderWithContext(
            <StaticSelectElement
                element={{
                    type: 'static_select',
                    action_id: 'user_sel',
                    placeholder: 'Select user',
                    data_source: 'users',
                }}
                postId={postId}
                onAction={onAction}
            />,
            {},
            {useMockedStore: true},
        );

        expect(screen.getByTestId('autocomplete-mock')).toBeInTheDocument();
        expect(screen.getByTestId('autocomplete-placeholder')).toHaveTextContent('Select user');
    });
});
