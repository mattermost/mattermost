// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, fireEvent} from '@testing-library/react';
import React from 'react';

import SaveConfirmationModal from './save_confirmation_modal';

jest.mock('components/external_link', () => {
    return jest.fn().mockImplementation(({children, ...props}) => {
        return <a {...props}>{children}</a>;
    });
});

describe('SaveConfirmationModal', () => {
    const onCloseMock = jest.fn();
    const onConfirmMock = jest.fn();
    const title = 'Test Title';
    const subtitle = 'Test Subtitle';
    const buttonText = 'Test Button Text';

    const baseProps = {
        onClose: onCloseMock,
        onConfirm: onConfirmMock,
        title,
        subtitle,
        buttonText,
    };

    test('renders the title and subtitle', () => {
        const {getByText} = render(
            <SaveConfirmationModal
                {...baseProps}
            />,
        );

        expect(getByText(title)).toBeInTheDocument();
        expect(getByText(subtitle)).toBeInTheDocument();
    });

    test('renders the disclaimer if includeDisclaimer is true', () => {
        const {getByText} = render(
            <SaveConfirmationModal
                {...baseProps}
                includeDisclaimer={true}
            />,
        );

        expect(getByText('Using the Customer Portal to restore access')).toBeInTheDocument();
    });

    test('calls onClose when the cancel button is clicked', () => {
        const {getByText} = render(
            <SaveConfirmationModal
                {...baseProps}
            />,
        );

        fireEvent.click(getByText('Cancel'));

        expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    test('calls onConfirm when the confirm button is clicked', () => {
        const {getByText} = render(
            <SaveConfirmationModal
                {...baseProps}
            />,
        );

        fireEvent.click(getByText(buttonText));

        expect(onConfirmMock).toHaveBeenCalledTimes(1);
    });
});
