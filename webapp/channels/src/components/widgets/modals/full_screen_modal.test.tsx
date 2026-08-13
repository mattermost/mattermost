// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import FullScreenModal from './full_screen_modal';

describe('components/widgets/modals/FullScreenModal', () => {
    test('showing content', () => {
        const {container} = renderWithContext(
            <FullScreenModal
                show={true}
                onClose={jest.fn()}
                ariaLabel='test'
            >
                {'test'}
            </FullScreenModal>,
        );
        expect(container).toMatchSnapshot();
    });
    test('not showing content', () => {
        const {container} = renderWithContext(
            <FullScreenModal
                show={false}
                onClose={jest.fn()}
                ariaLabel='test'
            >
                {'test'}
            </FullScreenModal>,
        );
        expect(container).toMatchSnapshot();
    });
    test('with back icon', () => {
        const {container} = renderWithContext(
            <FullScreenModal
                show={true}
                onClose={jest.fn()}
                onGoBack={jest.fn()}
                ariaLabel='test'
            >
                {'test'}
            </FullScreenModal>,
        );
        expect(container).toMatchSnapshot();
    });

    test('close on close icon click', async () => {
        const close = jest.fn();
        renderWithContext(
            <FullScreenModal
                show={true}
                onClose={close}
                ariaLabel='test'
            >
                {'test'}
            </FullScreenModal>,
        );
        expect(close).not.toHaveBeenCalled();
        await userEvent.click(screen.getByRole('button', {name: 'Close'}));
        expect(close).toHaveBeenCalled();
    });

    test('go back on back icon click', async () => {
        const back = jest.fn();
        renderWithContext(
            <FullScreenModal
                show={true}
                onClose={jest.fn()}
                onGoBack={back}
                ariaLabel='test'
            >
                {'test'}
            </FullScreenModal>,
        );
        expect(back).not.toHaveBeenCalled();
        await userEvent.click(screen.getByRole('button', {name: 'Back'}));
        expect(back).toHaveBeenCalled();
    });

    test('close on esc keypress', () => {
        const close = jest.fn();
        renderWithContext(
            <FullScreenModal
                show={true}
                onClose={close}
                ariaLabel='test'
            >
                {'test'}
            </FullScreenModal>,
        );
        expect(close).not.toHaveBeenCalled();
        const event = new KeyboardEvent('keydown', {key: 'Escape'});
        document.dispatchEvent(event);
        expect(close).toHaveBeenCalled();
    });
});
