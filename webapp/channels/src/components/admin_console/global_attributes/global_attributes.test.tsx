// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {GlobalAttributeListing, GlobalAttributeListingRow} from '@mattermost/types/global_attributes';
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
    const searchGlobalAttributes = jest.spyOn(Client4, 'searchGlobalAttributes');
    const emptyListing: GlobalAttributeListing = {rows: []};

    beforeEach(() => {
        searchGlobalAttributes.mockReset();
        searchGlobalAttributes.mockResolvedValue(emptyListing);
        mockHistoryPush.mockReset();
    });

    test('renders a "New attribute" button that navigates to the create page', async () => {
        renderWithContext(<GlobalAttributes/>);

        await userEvent.click(screen.getByRole('button', {name: 'New attribute'}));

        expect(mockHistoryPush).toHaveBeenCalledWith('/admin_console/system_attributes/manage_attributes/attribute_details');
    });

    test('disables the New attribute button when the page is read-only', async () => {
        renderWithContext(<GlobalAttributes disabled={true}/>);

        expect(screen.getByRole('button', {name: 'New attribute'})).toBeDisabled();
    });

    test('renders the header and section frame, and renders the attributes table', async () => {
        renderWithContext(<GlobalAttributes/>);

        // * Title, subtitle, and the create action all live inside the AdminHeader
        // bar (not a separate boxed section below it) — the page has one title,
        // not a repeated one, and the button sits top-right of that header.
        const header = within(screen.getByTestId('admin-console-header'));
        expect(header.getByText('Attribute Management')).toBeInTheDocument();
        expect(header.getByText('Define an attribute once, then choose which resources can use it.')).toBeInTheDocument();
        expect(header.getByRole('button', {name: 'New attribute'})).toBeInTheDocument();
        expect(screen.getByRole('heading', {name: 'Attribute Management'})).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByTestId('global-attributes-empty')).toBeInTheDocument();
        });
    });

    test('renders a search field above the table that filters attributes', async () => {
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
        const rowFor = (field: PropertyField): GlobalAttributeListingRow => ({
            field,
            applies_to: [],
            owners: [],
            source_kind: 'managed',
            sync_sources: [],
            is_classification: false,
        });

        // The server does the matching, so the mock answers by the term it is sent.
        searchGlobalAttributes.mockImplementation(async ({term}) => {
            const rows = fields.
                filter((field) => !term || String(field.attrs?.display_name).toLowerCase().includes(term)).
                map(rowFor);
            return {rows};
        });

        renderWithContext(<GlobalAttributes/>);

        expect(await screen.findByText('Clearance')).toBeInTheDocument();
        expect(screen.getByText('Department')).toBeInTheDocument();

        const header = within(screen.getByTestId('admin-console-header'));
        expect(header.getByTestId('newAttributeButton')).toBeInTheDocument();
        expect(header.queryByTestId('global-attributes-search')).not.toBeInTheDocument();

        const search = screen.getByTestId('global-attributes-search');

        // The server rejects a term longer than a field name can be.
        expect(search).toHaveAttribute('maxLength', '255');

        await userEvent.type(search, 'clear');

        await waitFor(() => {
            expect(searchGlobalAttributes).toHaveBeenLastCalledWith(expect.objectContaining({term: 'clear'}));
        });
        await waitFor(() => {
            expect(screen.queryByText('Department')).not.toBeInTheDocument();
        });
        expect(screen.getByText('Clearance')).toBeInTheDocument();
    });

    describe('source filter', () => {
        const pickSource = async (label: string) => {
            await userEvent.click(screen.getByTestId('global-attributes-source-filter'));
            await userEvent.click(screen.getByRole('menuitemradio', {name: label}));
        };
        const shownSource = () => within(screen.getByTestId('global-attributes-source-filter')).getByRole('textbox', {hidden: true});

        test('renders beside the search field, defaulting to All, and sends no source', async () => {
            renderWithContext(<GlobalAttributes/>);

            expect(screen.getByTestId('global-attributes-search').closest('.GlobalAttributes__actions')).toContainElement(screen.getByTestId('global-attributes-source-filter'));
            expect(shownSource()).toHaveValue('All');
            await waitFor(() => expect(searchGlobalAttributes).toHaveBeenCalledTimes(1));
            expect(searchGlobalAttributes.mock.calls[0][0].source).toBeUndefined();
        });

        test('picking a source requests it, and All drops it again', async () => {
            renderWithContext(<GlobalAttributes/>);
            await waitFor(() => expect(searchGlobalAttributes).toHaveBeenCalledTimes(1));

            await pickSource('LDAP');
            await waitFor(() => {
                expect(searchGlobalAttributes).toHaveBeenLastCalledWith(expect.objectContaining({source: 'ldap'}));
            });
            expect(shownSource()).toHaveValue('LDAP');

            await pickSource('All');
            await waitFor(() => {
                expect(searchGlobalAttributes.mock.calls[searchGlobalAttributes.mock.calls.length - 1][0].source).toBeUndefined();
            });
        });

        test('combines with the search term', async () => {
            renderWithContext(<GlobalAttributes/>);
            await waitFor(() => expect(searchGlobalAttributes).toHaveBeenCalledTimes(1));

            await pickSource('SAML');
            await userEvent.type(screen.getByTestId('global-attributes-search'), 'dept');

            await waitFor(() => {
                expect(searchGlobalAttributes).toHaveBeenLastCalledWith({term: 'dept', source: 'saml'});
            });
        });

        test('stays usable when the page is read-only, like the search field', async () => {
            renderWithContext(<GlobalAttributes disabled={true}/>);
            await waitFor(() => expect(searchGlobalAttributes).toHaveBeenCalledTimes(1));

            await pickSource('Plugin');

            await waitFor(() => {
                expect(searchGlobalAttributes).toHaveBeenLastCalledWith(expect.objectContaining({source: 'plugin'}));
            });
        });

        test('Clear filters in the no-match state resets the search and the source', async () => {
            renderWithContext(<GlobalAttributes/>);
            await waitFor(() => expect(searchGlobalAttributes).toHaveBeenCalledTimes(1));

            await userEvent.type(screen.getByTestId('global-attributes-search'), 'zzz');
            await pickSource('OpenID');

            expect(await screen.findByTestId('global-attributes-empty-search')).toBeInTheDocument();
            expect(screen.queryByTestId('global-attributes-empty')).not.toBeInTheDocument();

            await userEvent.click(screen.getByRole('button', {name: 'Clear filters'}));

            expect(screen.getByTestId('global-attributes-search')).toHaveValue('');
            expect(shownSource()).toHaveValue('All');
            await waitFor(() => {
                expect(searchGlobalAttributes).toHaveBeenLastCalledWith({term: undefined, source: undefined});
            });
            expect(await screen.findByTestId('global-attributes-empty')).toBeInTheDocument();
        });
    });
});
