// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {MmButtonBlock} from '@mattermost/types/mm_blocks';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import {ButtonElement} from './button_element';
import {MmBlocksHandlersContext, MmBlocksInteractionsDisabledContext} from './context';
import {MmBlocksForm, useMmBlocksForm} from './form';

function renderButton(
    element: MmButtonBlock,
    onAction: jest.Mock,
    interactionsDisabled = false,
) {
    return renderWithContext(
        <MmBlocksHandlersContext.Provider value={{onAction}}>
            <MmBlocksForm
                errors={{}}
                onErrorsChange={jest.fn()}
            >
                <MmBlocksInteractionsDisabledContext.Provider value={interactionsDisabled}>
                    <ButtonElement
                        element={element}
                    />
                </MmBlocksInteractionsDisabledContext.Provider>
            </MmBlocksForm>
        </MmBlocksHandlersContext.Provider>,
    );
}

describe('ButtonElement', () => {
    const onAction = jest.fn();

    beforeEach(() => {
        onAction.mockClear();
    });

    it('returns null when text is missing', () => {
        const {container} = renderButton(
            {type: 'button', action_id: 'btn-1', text: ''},
            onAction,
        );
        expect(container.querySelector('button')).toBeNull();
    });

    it('returns null when action_id is missing', () => {
        const {container} = renderButton(
            {type: 'button', text: 'Click'} as MmButtonBlock,
            onAction,
        );
        expect(container.querySelector('button')).toBeNull();
    });

    it('renders button with style class and dispatches on click', async () => {
        const user = userEvent.setup();
        renderButton({
            type: 'button',
            text: 'Approve',
            action_id: 'approve',
            style: 'primary',
            query: {foo: 'bar'},
            cookie: 'cookie-1',
        }, onAction);

        const button = screen.getByRole('button', {name: 'Approve'});
        expect(button).toHaveClass('btn-primary');
        expect(button).not.toBeDisabled();

        await user.click(button);
        expect(onAction).toHaveBeenCalledWith('approve', undefined, {foo: 'bar'}, 'cookie-1', undefined);
    });

    it('submit subtype sends form values separately from query', async () => {
        function SeedAndSubmit() {
            const {setValue} = useMmBlocksForm();
            React.useEffect(() => {
                setValue('title', 'Bug report');
                setValue('email', 'you@example.com');
            }, [setValue]);

            return (
                <ButtonElement
                    element={{
                        type: 'button',
                        text: 'Submit',
                        action_id: 'form_submit',
                        subtype: 'submit',
                        style: 'primary',
                        query: {source: 'fixture'},
                    }}
                />
            );
        }

        const user = userEvent.setup();
        renderWithContext(
            <MmBlocksHandlersContext.Provider value={{onAction}}>
                <MmBlocksForm
                    errors={{}}
                    onErrorsChange={jest.fn()}
                >
                    <SeedAndSubmit/>
                </MmBlocksForm>
            </MmBlocksHandlersContext.Provider>,
        );

        await user.click(screen.getByRole('button', {name: 'Submit'}));
        expect(onAction).toHaveBeenCalledWith(
            'form_submit',
            undefined,
            {source: 'fixture'},
            undefined,
            {
                title: 'Bug report',
                email: 'you@example.com',
            },
        );
    });

    it('renders semantic good style class', () => {
        renderButton({
            type: 'button',
            text: 'Acknowledge',
            action_id: 'ack',
            style: 'good',
        }, onAction);

        expect(screen.getByRole('button', {name: 'Acknowledge'})).toHaveClass('mm-blocks-button--good');
    });

    it('applies inline color for hex style', () => {
        renderButton({
            type: 'button',
            text: 'Custom',
            action_id: 'custom',
            style: '#28a745',
        }, onAction);

        expect(screen.getByRole('button', {name: 'Custom'})).toHaveStyle({color: 'rgb(40, 167, 69)'});
    });

    it('shows loading spinner and disables while onAction promise is pending', async () => {
        let resolveAction!: () => void;
        const onActionPending = jest.fn(() => new Promise<void>((resolve) => {
            resolveAction = resolve;
        }));
        const user = userEvent.setup();

        renderButton({
            type: 'button',
            text: 'Approve',
            action_id: 'approve',
        }, onActionPending);

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
        renderButton({
            type: 'button',
            text: ':smile:',
            action_id: 'emoji',
        }, onAction);

        const button = screen.getByRole('button');
        expect(button.querySelector('.emoticon')).toBeInTheDocument();
    });

    it('disables the button when disabled is true', () => {
        renderButton({
            type: 'button',
            text: 'Disabled',
            action_id: 'd',
            disabled: true,
        }, onAction);

        expect(screen.getByRole('button', {name: 'Disabled'})).toBeDisabled();
    });

    it('disables the button and does not dispatch when interactions are disabled', async () => {
        renderButton({
            type: 'button',
            text: 'Preview',
            action_id: 'preview',
        }, onAction, true);

        const button = screen.getByRole('button', {name: 'Preview'});
        expect(button).toBeDisabled();
        await userEvent.click(button);
        expect(onAction).not.toHaveBeenCalled();
    });
});
