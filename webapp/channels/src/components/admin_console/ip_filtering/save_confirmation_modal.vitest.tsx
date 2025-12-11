// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, fireEvent} from 'tests/vitest_react_testing_utils';

import SaveConfirmationModal from './save_confirmation_modal';

vi.mock('components/external_link', () => ({
    default: vi.fn().mockImplementation(({children, ...props}) => {
        return <a {...props}>{children}</a>;
    }),
}));

describe('SaveConfirmationModal', () => {
    const onExitedMock = vi.fn();
    const onConfirmMock = vi.fn();
    const title = 'Test Title';
    const subtitle = 'Test Subtitle';
    const buttonText = 'Test Button Text';

    const baseProps = {
        onExited: onExitedMock,
        onConfirm: onConfirmMock,
        title,
        subtitle,
        buttonText,
    };

    test('renders the title and subtitle', () => {
        renderWithContext(
            <SaveConfirmationModal
                {...baseProps}
            />,
        );

        expect(screen.getByText(title)).toBeInTheDocument();
        expect(screen.getByText(subtitle)).toBeInTheDocument();
    });

    test('renders the disclaimer if includeDisclaimer is true', () => {
        renderWithContext(
            <SaveConfirmationModal
                {...baseProps}
                includeDisclaimer={true}
            />,
        );

        expect(screen.getByText('Using the Customer Portal to restore access')).toBeInTheDocument();
    });

    test('calls onClose when the cancel button is clicked', () => {
        renderWithContext(
            <SaveConfirmationModal
                {...baseProps}
            />,
        );

        fireEvent.click(screen.getByText('Cancel'));

        expect(onExitedMock).toHaveBeenCalledTimes(1);
    });

    test('calls onConfirm when the confirm button is clicked', () => {
        renderWithContext(
            <SaveConfirmationModal
                {...baseProps}
            />,
        );

        fireEvent.click(screen.getByText(buttonText));

        expect(onConfirmMock).toHaveBeenCalledTimes(1);
    });
});
