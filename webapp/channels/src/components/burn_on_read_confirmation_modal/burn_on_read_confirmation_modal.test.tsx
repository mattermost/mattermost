// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent} from '@testing-library/react';
import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import BurnOnReadConfirmationModal from './burn_on_read_confirmation_modal';

describe('BurnOnReadConfirmationModal', () => {
    const baseProps = {
        show: true,
        onConfirm: jest.fn(),
        onCancel: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should render receiver delete message when show is true and isSenderDelete is false', () => {
        renderWithContext(<BurnOnReadConfirmationModal {...baseProps}/>);

        expect(screen.getByText('Delete Message Now?')).toBeInTheDocument();
        expect(screen.getByText(/This message will be permanently deleted for you right away/)).toBeInTheDocument();
    });

    it('should render sender delete message when show is true and isSenderDelete is true', () => {
        renderWithContext(
            <BurnOnReadConfirmationModal
                {...baseProps}
                isSenderDelete={true}
            />,
        );

        expect(screen.getByText('Delete Message Now?')).toBeInTheDocument();
        expect(screen.getByText(/This message will be permanently deleted for all recipients right away/)).toBeInTheDocument();
    });

    it('should not render when show is false', () => {
        renderWithContext(
            <BurnOnReadConfirmationModal
                {...baseProps}
                show={false}
            />,
        );

        expect(screen.queryByText('Delete Message Now?')).not.toBeInTheDocument();
    });

    it('should call onCancel when Cancel button is clicked', () => {
        const onCancel = jest.fn();
        renderWithContext(
            <BurnOnReadConfirmationModal
                {...baseProps}
                onCancel={onCancel}
            />,
        );

        const cancelButton = screen.getByText('Cancel');
        fireEvent.click(cancelButton);

        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('should call onConfirm with false when Delete Now button is clicked without checkbox', () => {
        const onConfirm = jest.fn();
        renderWithContext(
            <BurnOnReadConfirmationModal
                {...baseProps}
                onConfirm={onConfirm}
            />,
        );

        const confirmButton = screen.getByText('Delete Now');
        fireEvent.click(confirmButton);

        expect(onConfirm).toHaveBeenCalledWith(false);
    });

    it('should show checkbox when showCheckbox prop is true', () => {
        renderWithContext(
            <BurnOnReadConfirmationModal
                {...baseProps}
                showCheckbox={true}
            />,
        );

        expect(screen.getByText('Do not ask me again')).toBeInTheDocument();
        expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    it('should not show checkbox when showCheckbox prop is false', () => {
        renderWithContext(
            <BurnOnReadConfirmationModal
                {...baseProps}
                showCheckbox={false}
            />,
        );

        expect(screen.queryByText('Do not ask me again')).not.toBeInTheDocument();
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('should call onConfirm with true when checkbox is checked', () => {
        const onConfirm = jest.fn();
        renderWithContext(
            <BurnOnReadConfirmationModal
                {...baseProps}
                onConfirm={onConfirm}
                showCheckbox={true}
            />,
        );

        const checkbox = screen.getByRole('checkbox');
        fireEvent.click(checkbox);

        const confirmButton = screen.getByText('Delete Now');
        fireEvent.click(confirmButton);

        expect(onConfirm).toHaveBeenCalledWith(true);
    });

    it('should disable confirm button and show loading text when loading', () => {
        renderWithContext(
            <BurnOnReadConfirmationModal
                {...baseProps}
                loading={true}
            />,
        );

        const confirmButton = screen.getByText('Deleting...').closest('button');
        expect(confirmButton).toBeDisabled();
        expect(screen.getByText('Deleting...')).toBeInTheDocument();
    });

    it('should autofocus Delete Now button', () => {
        renderWithContext(<BurnOnReadConfirmationModal {...baseProps}/>);

        const confirmButton = screen.getByText('Delete Now');
        expect(confirmButton).toHaveFocus();
    });
});
