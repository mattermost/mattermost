// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Client4} from 'mattermost-redux/client';

import {renderWithContext, screen, userEvent, waitFor, within} from 'tests/react_testing_utils';

import GlobalAttributes from './global_attributes';

const mockHistoryPush = jest.fn();
jest.mock('utils/browser_history', () => ({
    getHistory: () => ({
        push: mockHistoryPush,
    }),
}));

describe('components/admin_console/global_attributes/GlobalAttributes', () => {
    const getPropertyFields = jest.spyOn(Client4, 'getPropertyFields');

    beforeEach(() => {
        getPropertyFields.mockReset();
        getPropertyFields.mockResolvedValue([]);
        mockHistoryPush.mockReset();
    });

    test('renders a "New attribute" button that navigates to the create page', async () => {
        renderWithContext(<GlobalAttributes/>);

        await userEvent.click(screen.getByRole('button', {name: 'New attribute'}));

        expect(mockHistoryPush).toHaveBeenCalledWith('/admin_console/system_attributes/manage_attributes/attribute_details');
    });

    test('renders the header and section frame, and renders the attributes table', async () => {
        renderWithContext(<GlobalAttributes/>);

        // * Title and subtitle both live inside the AdminHeader bar (not a separate
        // boxed section below it) — the page has one title, not a repeated one.
        const header = within(screen.getByTestId('admin-console-header'));
        expect(header.getByText('Manage Attributes')).toBeInTheDocument();
        expect(header.getByText('Define an attribute once, then choose which resources can use it.')).toBeInTheDocument();
        expect(screen.getByRole('heading', {name: 'Manage Attributes'})).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByTestId('global-attributes-empty')).toBeInTheDocument();
        });
    });
});
