// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, fireEvent, waitFor} from '@testing-library/react';
import React from 'react';

import type {AllowedIPRange} from '@mattermost/types/config';

import IPFilteringAddOrEditModal from './add_edit_ip_filter_modal';

jest.mock('components/external_link', () => {
    return jest.fn().mockImplementation(({children, ...props}) => {
        return <a {...props}>{children}</a>;
    });
});

describe('IPFilteringAddOrEditModal', () => {
    const onClose = jest.fn();
    const onSave = jest.fn();
    const existingRange: AllowedIPRange = {
        CIDRBlock: '192.168.0.0/16',
        Description: 'Test IP Filter',
        Enabled: true,
        OwnerID: '',
    };
    const currentIP = '192.168.0.1';

    const baseProps = {
        onClose,
        onSave,
        existingRange,
        currentIP,
    };

    test('renders the modal with the correct title when an existingRange is provided', () => {
        const {getByText} = render(
            <IPFilteringAddOrEditModal
                {...baseProps}
            />,
        );

        expect(getByText('Edit IP Filter')).toBeInTheDocument();
    });

    test('renders the modal with the correct title when an existingRange is omitted (ie, Add Modal)', () => {
        const {getByText} = render(
            <IPFilteringAddOrEditModal
                {...baseProps}
                existingRange={undefined}
            />,
        );

        expect(getByText('Add IP Filter')).toBeInTheDocument();
    });

    test('renders the modal with the correct inputs and values', () => {
        const {getByLabelText} = render(
            <IPFilteringAddOrEditModal
                {...baseProps}
            />,
        );

        expect(getByLabelText('Enter a name for this rule')).toHaveValue('Test IP Filter');
        expect(getByLabelText('Enter IP Range')).toHaveValue('192.168.0.0/16');
    });

    test('calls the onSave function with the correct values when the Save button is clicked', async () => {
        const {getByLabelText, getByTestId} = render(
            <IPFilteringAddOrEditModal
                {...baseProps}
            />,
        );

        fireEvent.change(getByLabelText('Enter a name for this rule'), {target: {value: 'Test IP Filter 2'}});
        fireEvent.change(getByLabelText('Enter IP Range'), {target: {value: '10.0.0.0/8'}});
        fireEvent.click(getByTestId('save-add-edit-button'));

        await waitFor(() => {
            expect(onSave).toHaveBeenCalledWith({
                CIDRBlock: '10.0.0.0/8',
                Description: 'Test IP Filter 2',
                Enabled: true,
                OwnerID: '',
            }, existingRange);
            expect(onClose).toHaveBeenCalled();
        });
    });

    test('calls the onSave function with the correct values when the Save button is clicked for a new IP filter', async () => {
        const {getByLabelText, getByTestId} = render(
            <IPFilteringAddOrEditModal
                {...baseProps}
                existingRange={undefined}
            />,
        );

        fireEvent.change(getByLabelText('Enter a name for this rule'), {target: {value: 'Test IP Filter 2'}});
        fireEvent.change(getByLabelText('Enter IP Range'), {target: {value: '10.0.0.0/8'}});
        fireEvent.click(getByTestId('save-add-edit-button'));

        await waitFor(() => {
            expect(onSave).toHaveBeenCalledWith({
                CIDRBlock: '10.0.0.0/8',
                Description: 'Test IP Filter 2',
                Enabled: true,
                OwnerID: '',
            });
            expect(onClose).toHaveBeenCalled();
        });
    });

    test('displays an error message when an invalid CIDR is entered', async () => {
        const {getByLabelText, getByTestId, getByText} = render(
            <IPFilteringAddOrEditModal
                {...baseProps}
            />,
        );

        fireEvent.change(getByLabelText('Enter IP Range'), {target: {value: 'invalid-cidr'}});
        fireEvent.blur(getByLabelText('Enter IP Range'));
        fireEvent.click(getByTestId('save-add-edit-button'));

        await waitFor(() => {
            expect(getByText('Invalid CIDR address range')).toBeInTheDocument();
            expect(onSave).not.toHaveBeenCalled();
            expect(onClose).not.toHaveBeenCalled();
        });
    });

    test('disables the Save button when an invalid CIDR is entered', () => {
        const {getByLabelText, getByTestId} = render(
            <IPFilteringAddOrEditModal
                {...baseProps}
            />,
        );

        fireEvent.change(getByLabelText('Enter IP Range'), {target: {value: 'invalid-cidr'}});
        fireEvent.blur(getByLabelText('Enter IP Range'));

        expect(getByTestId('save-add-edit-button')).toBeDisabled();
    });
});
