// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {MmButtonBlock} from '@mattermost/types/mm_blocks';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import {ButtonElement} from './button_element';
import {MmBlocksInteractionsDisabledContext} from './context';

describe('ButtonElement', () => {
    const onAction = jest.fn();

    beforeEach(() => {
        onAction.mockClear();
    });

    it('returns null when text is missing', () => {
        const {container} = renderWithContext(
            <ButtonElement
                element={{type: 'button', action_id: 'btn-1', text: ''}}
                onAction={onAction}
            />,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('returns null when action_id is missing', () => {
        const {container} = renderWithContext(
            <ButtonElement
                element={{type: 'button', text: 'Click'} as MmButtonBlock}
                onAction={onAction}
            />,
        );
        expect(container).toBeEmptyDOMElement();
    });

    it('renders button with style class and dispatches on click', async () => {
        const user = userEvent.setup();
        renderWithContext(
            <ButtonElement
                element={{
                    type: 'button',
                    text: 'Approve',
                    action_id: 'approve',
                    style: 'primary',
                    query: {foo: 'bar'},
                    cookie: 'cookie-1',
                }}
                onAction={onAction}
            />,
        );

        const button = screen.getByRole('button', {name: 'Approve'});
        expect(button).toHaveClass('btn-primary');
        expect(button).not.toBeDisabled();

        await user.click(button);
        expect(onAction).toHaveBeenCalledWith('approve', undefined, {foo: 'bar'}, 'cookie-1');
    });

    it('renders semantic good style class', () => {
        renderWithContext(
            <ButtonElement
                element={{
                    type: 'button',
                    text: 'Acknowledge',
                    action_id: 'ack',
                    style: 'good',
                }}
                onAction={onAction}
            />,
        );

        expect(screen.getByRole('button', {name: 'Acknowledge'})).toHaveClass('mm-blocks-button--good');
    });

    it('applies inline color for hex style', () => {
        renderWithContext(
            <ButtonElement
                element={{
                    type: 'button',
                    text: 'Custom',
                    action_id: 'custom',
                    style: '#28a745',
                }}
                onAction={onAction}
            />,
        );

        expect(screen.getByRole('button', {name: 'Custom'})).toHaveStyle({color: 'rgb(40, 167, 69)'});
    });

    it('shows loading spinner and disables while onAction promise is pending', async () => {
        let resolveAction!: () => void;
        const onActionPending = jest.fn(() => new Promise<void>((resolve) => {
            resolveAction = resolve;
        }));
        const user = userEvent.setup();

        renderWithContext(
            <ButtonElement
                element={{
                    type: 'button',
                    text: 'Approve',
                    action_id: 'approve',
                }}
                onAction={onActionPending}
            />,
        );

        const button = screen.getByRole('button', {name: 'Approve'});
        await user.click(button);

        expect(button).toBeDisabled();
        expect(button).toHaveAttribute('aria-busy', 'true');
        expect(screen.getByTestId('loadingSpinner')).toBeInTheDocument();
        expect(screen.getByText('Approve')).toBeInTheDocument();

        resolveAction();
        await screen.findByRole('button', {name: 'Approve'});
        expect(screen.getByRole('button', {name: 'Approve'})).not.toBeDisabled();
        expect(screen.queryByTestId('loadingSpinner')).not.toBeInTheDocument();
    });

    it('renders emoticons in button text', () => {
        renderWithContext(
            <ButtonElement
                element={{
                    type: 'button',
                    text: ':smile:',
                    action_id: 'emoji',
                }}
                onAction={onAction}
            />,
        );

        const button = screen.getByRole('button');
        expect(button.querySelector('.emoticon')).toBeInTheDocument();
    });

    it('disables the button when disabled is true', () => {
        renderWithContext(
            <ButtonElement
                element={{
                    type: 'button',
                    text: 'Disabled',
                    action_id: 'd',
                    disabled: true,
                }}
                onAction={onAction}
            />,
        );

        expect(screen.getByRole('button', {name: 'Disabled'})).toBeDisabled();
    });

    it('disables the button and does not dispatch when interactions are disabled', async () => {
        renderWithContext(
            <MmBlocksInteractionsDisabledContext.Provider value={true}>
                <ButtonElement
                    element={{
                        type: 'button',
                        text: 'Preview',
                        action_id: 'preview',
                    }}
                    onAction={onAction}
                />
            </MmBlocksInteractionsDisabledContext.Provider>,
        );

        const button = screen.getByRole('button', {name: 'Preview'});
        expect(button).toBeDisabled();
        await userEvent.click(button);
        expect(onAction).not.toHaveBeenCalled();
    });
});
