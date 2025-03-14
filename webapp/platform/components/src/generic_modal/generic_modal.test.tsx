// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen, waitFor} from '@testing-library/react';
import React from 'react';

import {GenericModal} from './generic_modal';

import {wrapIntl} from '../testUtils';

describe('GenericModal', () => {
    const baseProps = {
        onExited: jest.fn(),
        modalHeaderText: 'Modal Header Text',
        children: <></>,
    };

    test('should match snapshot for base case', () => {
        const wrapper = render(
            wrapIntl(<GenericModal {...baseProps}/>),
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should have confirm and cancels buttons when handlers are passed for both buttons', () => {
        const props = {
            ...baseProps,
            handleConfirm: jest.fn(),
            handleCancel: jest.fn(),
        };

        render(
            wrapIntl(<GenericModal {...props}/>),
        );

        expect(screen.getByText('Confirm')).toBeInTheDocument();
        expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    test('calls onExited when modal exits', async () => {
        const onExitedMock = jest.fn();
        const props = {
            ...baseProps,
            onExited: onExitedMock,
        };
        render(
            wrapIntl(<GenericModal {...props}/>),
        );

        // Find and click the close button to trigger modal exit
        const closeButton = screen.getByLabelText('Close');
        closeButton.click();

        // Wait for onExited to be called
        await waitFor(() => {
            expect(onExitedMock).toHaveBeenCalled();
        });
    });

    test('does not throw if onExited is undefined', async () => {
        // Create props without onExited
        const {onExited, ...propsWithoutOnExited} = baseProps; // eslint-disable-line @typescript-eslint/no-unused-vars
        const props = {
            ...propsWithoutOnExited,
            onHide: jest.fn(), // Ensure onHide is provided since it's mandatory
        };

        // This should not throw
        render(
            wrapIntl(<GenericModal {...props}/>),
        );

        // Find and click the close button to trigger modal exit
        const closeButton = screen.getByLabelText('Close');

        // This should not throw
        expect(() => {
            closeButton.click();
        }).not.toThrow();
    });

    test('calls onEntered when modal enters', async () => {
        const onEnteredMock = jest.fn();
        const props = {
            ...baseProps,
            onEntered: onEnteredMock,
            show: false, // Start with modal hidden
        };

        const {rerender} = render(
            wrapIntl(<GenericModal {...props}/>),
        );

        // Show the modal
        rerender(
            wrapIntl(<GenericModal {...props} show={true}/>),
        );

        // Wait for onEntered to be called
        await waitFor(() => {
            expect(onEnteredMock).toHaveBeenCalled();
        });
    });

    test('does not throw if onEntered is undefined', async () => {
        // Create props without onEntered
        const props = {
            ...baseProps,
            show: false, // Start with modal hidden
        };

        const {rerender} = render(
            wrapIntl(<GenericModal {...props}/>),
        );

        // This should not throw
        expect(() => {
            rerender(
                wrapIntl(<GenericModal {...props} show={true}/>),
            );
        }).not.toThrow();
    });

    test('calls onHide when modal is closed', async () => {
        const onHideMock = jest.fn();
        const props = {
            ...baseProps,
            onHide: onHideMock,
        };
        render(
            wrapIntl(<GenericModal {...props}/>),
        );

        // Find and click the close button to trigger modal exit
        const closeButton = screen.getByLabelText('Close');
        closeButton.click();

        // Wait for onHide to be called
        await waitFor(() => {
            expect(onHideMock).toHaveBeenCalled();
        });
    });
});
