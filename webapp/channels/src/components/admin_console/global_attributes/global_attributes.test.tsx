// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyField} from '@mattermost/types/properties';

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
        expect(header.getByText('Attribute Management')).toBeInTheDocument();
        expect(header.getByText('Define an attribute once, then choose which resources can use it.')).toBeInTheDocument();
        expect(screen.getByRole('heading', {name: 'Attribute Management'})).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByTestId('global-attributes-empty')).toBeInTheDocument();
        });
    });

    test('renders a search field to the left of the new-attribute button that filters the table', async () => {
        const fields = [
            {
                id: 'field-clearance',
                name: 'clearance',
                type: 'select',
                group_id: 'accesscontrolgroupuuid001',
                object_type: 'template',
                target_id: '',
                target_type: 'system',
                create_at: 1700000000000,
                update_at: 0,
                delete_at: 0,
                created_by: '',
                updated_by: '',
                attrs: {display_name: 'Clearance'},
            },
            {
                id: 'field-department',
                name: 'department',
                type: 'text',
                group_id: 'accesscontrolgroupuuid001',
                object_type: 'template',
                target_id: '',
                target_type: 'system',
                create_at: 1700000000000,
                update_at: 0,
                delete_at: 0,
                created_by: '',
                updated_by: '',
                attrs: {display_name: 'Department'},
            },
        ] as PropertyField[];
        getPropertyFields.mockResolvedValueOnce(fields).mockResolvedValue([]);

        renderWithContext(<GlobalAttributes/>);

        expect(await screen.findByText('Clearance')).toBeInTheDocument();
        expect(screen.getByText('Department')).toBeInTheDocument();

        const search = screen.getByTestId('global-attributes-search');
        expect(search.compareDocumentPosition(screen.getByTestId('newAttributeButton'))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
        await userEvent.type(search, 'clear');

        expect(screen.getByText('Clearance')).toBeInTheDocument();
        expect(screen.queryByText('Department')).not.toBeInTheDocument();
    });
});
