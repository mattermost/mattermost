// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, waitFor} from '@testing-library/react';
import React from 'react';
import {describe, test, expect, vi} from 'vitest';

import type {AllowedIPRange} from '@mattermost/types/config';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

import IPFilteringAddOrEditModal from './add_edit_ip_filter_modal';

vi.mock('components/external_link', () => ({
    default: vi.fn().mockImplementation(({children, ...props}) => {
        return <a {...props}>{children}</a>;
    }),
}));

describe('IPFilteringAddOrEditModal', () => {
    const onExited = vi.fn();
    const onSave = vi.fn();
    const existingRange: AllowedIPRange = {
        cidr_block: '192.168.0.0/16',
        description: 'Test IP Filter',
        enabled: true,
        owner_id: '',
    };
    const currentIP = '192.168.0.1';

    const baseProps = {
        onExited,
        onSave,
        existingRange,
        currentIP,
    };

    test('renders the modal with the correct title when an existingRange is provided', () => {
        const {getByText} = renderWithContext(
            <IPFilteringAddOrEditModal
                {...baseProps}
            />,
        );

        expect(getByText('Edit IP Filter')).toBeInTheDocument();
    });

    test('renders the modal with the correct title when an existingRange is omitted (ie, Add Modal)', () => {
        const {getByText} = renderWithContext(
            <IPFilteringAddOrEditModal
                {...baseProps}
                existingRange={undefined}
            />,
        );

        expect(getByText('Add IP Filter')).toBeInTheDocument();
    });

    test('renders the modal with the correct inputs and values', () => {
        const {getByLabelText} = renderWithContext(
            <IPFilteringAddOrEditModal
                {...baseProps}
            />,
        );

        expect(getByLabelText('Enter a name for this rule')).toHaveValue('Test IP Filter');
        expect(getByLabelText('Enter IP Range')).toHaveValue('192.168.0.0/16');
    });

    test('calls the onSave function with the correct values when the Save button is clicked', async () => {
        const onSaveLocal = vi.fn();
        const onExitedLocal = vi.fn();
        const {getByLabelText, getByTestId} = renderWithContext(
            <IPFilteringAddOrEditModal
                {...baseProps}
                onSave={onSaveLocal}
                onExited={onExitedLocal}
            />,
        );

        fireEvent.change(getByLabelText('Enter a name for this rule'), {target: {value: 'Test IP Filter 2'}});
        fireEvent.change(getByLabelText('Enter IP Range'), {target: {value: '10.0.0.0/8'}});
        fireEvent.click(getByTestId('save-add-edit-button'));

        await waitFor(() => {
            expect(onSaveLocal).toHaveBeenCalledWith({
                cidr_block: '10.0.0.0/8',
                description: 'Test IP Filter 2',
                enabled: true,
                owner_id: '',
            }, existingRange);
            expect(onExitedLocal).toHaveBeenCalled();
        });
    });

    test('calls the onSave function with the correct values when the Save button is clicked for a new IP filter', async () => {
        const onSaveLocal = vi.fn();
        const onExitedLocal = vi.fn();
        const {getByLabelText, getByTestId} = renderWithContext(
            <IPFilteringAddOrEditModal
                {...baseProps}
                existingRange={undefined}
                onSave={onSaveLocal}
                onExited={onExitedLocal}
            />,
        );

        fireEvent.change(getByLabelText('Enter a name for this rule'), {target: {value: 'Test IP Filter 2'}});
        fireEvent.change(getByLabelText('Enter IP Range'), {target: {value: '10.0.0.0/8'}});
        fireEvent.click(getByTestId('save-add-edit-button'));

        await waitFor(() => {
            expect(onSaveLocal).toHaveBeenCalledWith({
                cidr_block: '10.0.0.0/8',
                description: 'Test IP Filter 2',
                enabled: true,
                owner_id: '',
            });
            expect(onExitedLocal).toHaveBeenCalled();
        });
    });

    test('displays an error message when an invalid CIDR is entered', async () => {
        const onSaveLocal = vi.fn();
        const onExitedLocal = vi.fn();
        const {getByLabelText, getByTestId, getByText} = renderWithContext(
            <IPFilteringAddOrEditModal
                {...baseProps}
                onSave={onSaveLocal}
                onExited={onExitedLocal}
            />,
        );

        fireEvent.change(getByLabelText('Enter IP Range'), {target: {value: 'invalid-cidr'}});
        fireEvent.blur(getByLabelText('Enter IP Range'));
        fireEvent.click(getByTestId('save-add-edit-button'));

        await waitFor(() => {
            expect(getByText('Invalid CIDR address range')).toBeInTheDocument();
            expect(onSaveLocal).not.toHaveBeenCalled();
            expect(onExitedLocal).not.toHaveBeenCalled();
        });
    });

    test('disables the Save button when an invalid CIDR is entered', () => {
        const {getByLabelText, getByTestId} = renderWithContext(
            <IPFilteringAddOrEditModal
                {...baseProps}
            />,
        );

        fireEvent.change(getByLabelText('Enter IP Range'), {target: {value: 'invalid-cidr'}});
        fireEvent.blur(getByLabelText('Enter IP Range'));

        expect(getByTestId('save-add-edit-button')).toBeDisabled();
    });
});
