// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, fireEvent} from 'tests/vitest_react_testing_utils';

import FullScreenModal from './full_screen_modal';

describe('components/widgets/modals/FullScreenModal', () => {
    test('showing content', () => {
        const {container} = renderWithContext(
            <FullScreenModal
                show={true}
                onClose={vi.fn()}
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
                onClose={vi.fn()}
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
                onClose={vi.fn()}
                onGoBack={vi.fn()}
                ariaLabel='test'
            >
                {'test'}
            </FullScreenModal>,
        );
        expect(container).toMatchSnapshot();
    });

    test('close on close icon click', () => {
        const close = vi.fn();
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
        const closeButton = screen.getByLabelText('Close');
        fireEvent.click(closeButton);
        expect(close).toHaveBeenCalled();
    });

    test('go back on back icon click', () => {
        const back = vi.fn();
        renderWithContext(
            <FullScreenModal
                show={true}
                onClose={vi.fn()}
                onGoBack={back}
                ariaLabel='test'
            >
                {'test'}
            </FullScreenModal>,
        );
        expect(back).not.toHaveBeenCalled();
        const backButton = screen.getByLabelText('Back');
        fireEvent.click(backButton);
        expect(back).toHaveBeenCalled();
    });

    test('close on esc keypress', () => {
        const close = vi.fn();
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
