// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent, waitForElementToBeRemoved} from 'tests/react_testing_utils';

import ConfirmModalRedux from './confirm_modal_redux';

describe('ConfirmModalRedux', () => {
    const baseProps = {
        cancelButtonText: 'cancel',
        confirmButtonText: 'submit',
        onExited: jest.fn(),
    };

    test('should call closeModal after confirming', async () => {
        renderWithContext(
            <ConfirmModalRedux
                {...baseProps}
            />,
        );

        expect(screen.getByRole('dialog')).toBeVisible();
        expect(baseProps.onExited).not.toHaveBeenCalled();

        await userEvent.click(screen.getByText(baseProps.confirmButtonText));

        await waitForElementToBeRemoved(screen.getByRole('dialog'));
        expect(baseProps.onExited).toHaveBeenCalled();
    });

    test('should call onExited after cancelling', async () => {
        renderWithContext(
            <ConfirmModalRedux
                {...baseProps}
            />,
        );

        expect(screen.getByRole('dialog')).toBeVisible();
        expect(baseProps.onExited).not.toHaveBeenCalled();

        await userEvent.click(screen.getByText(baseProps.cancelButtonText));

        await waitForElementToBeRemoved(screen.getByRole('dialog'));
        expect(baseProps.onExited).toHaveBeenCalled();
    });
});
