// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, waitFor, within} from '@testing-library/react';
import React from 'react';

import {SESSION_ATTRIBUTES_GROUP_ID, SESSION_ATTRIBUTES_OBJECT_TYPE} from '@mattermost/types/properties_user';
import type {UserPropertyField} from '@mattermost/types/properties_user';
import type {DeepPartial} from '@mattermost/types/utilities';

import {Client4} from 'mattermost-redux/client';

import {renderWithContext, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import SessionAttributesPage from './session_attributes';

type ExtraAttrs = {
    options?: Array<{name: string}>;
    display_name?: string;
    enabled?: boolean;
    platforms?: string[];
    ttl_seconds?: number;
    grace_period_seconds?: number;
};

// The server keys every field under a real group UUID that differs from the
// group name; fixtures must mirror that so the resolve-by-name path is exercised.
// Typed as string (not the narrow literal) so the group_id, which is a real UUID
// rather than a known UserPropertyFieldGroupID, still satisfies the field cast.
const SESSION_GROUP_UUID: string = 'sessionattrsgroupuuid00001';

function makeField(name: string, type: 'text' | 'select', sortOrder: number, extra: ExtraAttrs = {}): UserPropertyField {
    const {options, ...tunables} = extra;

    return {
        id: `session-${name}`,
        name,
        type,
        group_id: SESSION_GROUP_UUID,
        create_at: 1736541716295,
        update_at: 0,
        delete_at: 0,
        created_by: '',
        updated_by: '',
        target_id: '',
        target_type: 'system',
        object_type: 'session',
        attrs: {
            sort_order: sortOrder,
            visibility: 'when_set',
            value_type: '',
            ...(options ? {options} : {}),
            ...tunables,
        },
    } as UserPropertyField;
}

const representativeFields: UserPropertyField[] = [
    makeField('ip_address', 'text', 0, {
        display_name: 'Client IP',
        platforms: ['desktop', 'browser'],
        ttl_seconds: 300,
        grace_period_seconds: 60,
        enabled: true,
    }),
    makeField('vpn_active', 'select', 1, {
        options: [{name: 'true'}, {name: 'false'}],
        platforms: ['desktop'],
        enabled: false,
    }),
];

function getBaseState(): DeepPartial<GlobalState> {
    const currentUser = TestHelper.getUserMock();

    return {
        entities: {
            users: {
                currentUserId: currentUser.id,
                profiles: {
                    [currentUser.id]: currentUser,
                },
            },
            general: {},
            properties: {
                fields: {
                    byId: {},
                    byObjectType: {},
                },
            },
        },
    };
}

describe('SessionAttributesPage', () => {
    const getPropertyFields = jest.spyOn(Client4, 'getPropertyFields');

    beforeEach(() => {
        getPropertyFields.mockReset();
    });

    it('fetches the session attribute fields once on mount', async () => {
        getPropertyFields.mockResolvedValueOnce(representativeFields).mockResolvedValue([]);

        renderWithContext(<SessionAttributesPage disabled={false}/>, getBaseState());

        await waitFor(() => {
            expect(getPropertyFields).toHaveBeenCalled();
        });

        expect(getPropertyFields.mock.calls[0].slice(0, 4)).toEqual([
            SESSION_ATTRIBUTES_GROUP_ID,
            'session',
            'system',
            undefined,
        ]);

        const initialFetches = getPropertyFields.mock.calls.filter((call) => call[4]?.cursorId === undefined);
        expect(initialFetches).toHaveLength(1);
    });

    it('shows the loading state before fields resolve', async () => {
        getPropertyFields.mockResolvedValueOnce(representativeFields).mockResolvedValue([]);

        renderWithContext(<SessionAttributesPage disabled={false}/>, getBaseState());

        expect(screen.getByText('Loading')).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.queryByText('Loading')).not.toBeInTheDocument();
        });
    });

    it('renders the table fed by the fetched fields', async () => {
        getPropertyFields.mockResolvedValueOnce(representativeFields).mockResolvedValue([]);

        renderWithContext(<SessionAttributesPage disabled={false}/>, getBaseState());

        expect(await screen.findByText('Client IP')).toBeInTheDocument();

        const typeLabels = screen.getAllByTestId('session-attribute-type').map((cell) => cell.textContent);
        expect(typeLabels).toContain('String');
        expect(typeLabels).toContain('Boolean');

        const statuses = screen.getAllByTestId('session-attribute-status').map((cell) => cell.textContent);
        expect(statuses).toContain('Enabled');
        expect(statuses).toContain('Disabled');

        expect(screen.getAllByTestId('session-attribute-platforms').length).toBe(representativeFields.length);
    });

    it('renders rows when fields resolve under a real group UUID distinct from the group name', async () => {
        expect(SESSION_GROUP_UUID).not.toEqual(SESSION_ATTRIBUTES_GROUP_ID);
        getPropertyFields.mockResolvedValueOnce(representativeFields).mockResolvedValue([]);

        renderWithContext(<SessionAttributesPage disabled={false}/>, getBaseState());

        expect(await screen.findByText('Client IP')).toBeInTheDocument();
        expect(screen.getAllByTestId('session-attribute-status')).toHaveLength(representativeFields.length);
        expect(screen.queryByText('No session attributes found.')).not.toBeInTheDocument();
    });

    it('shows the empty state when there are no fields', async () => {
        getPropertyFields.mockResolvedValue([]);

        renderWithContext(<SessionAttributesPage disabled={false}/>, getBaseState());

        expect(await screen.findByText('No session attributes found.')).toBeInTheDocument();
        expect(screen.queryByRole('columnheader', {name: 'Display Name'})).not.toBeInTheDocument();
    });

    it('shows an error state (not the empty state) when the fetch fails', async () => {
        getPropertyFields.mockRejectedValue(new Error('boom'));

        renderWithContext(<SessionAttributesPage disabled={false}/>, getBaseState());

        expect(await screen.findByText('There was an error while loading the session attributes.')).toBeInTheDocument();
        expect(screen.queryByText('No session attributes found.')).not.toBeInTheDocument();
    });

    it('renders the configure intro on mount', async () => {
        getPropertyFields.mockResolvedValueOnce(representativeFields).mockResolvedValue([]);

        renderWithContext(<SessionAttributesPage disabled={false}/>, getBaseState());

        expect(await screen.findByRole('heading', {name: 'Configure session attributes'})).toBeInTheDocument();
        expect(screen.getByText('Session attributes are evaluated per session and can be used in access control policies.')).toBeInTheDocument();
    });

    it('marks the table region advisory-disabled when the page is disabled', async () => {
        getPropertyFields.mockResolvedValue([]);

        renderWithContext(<SessionAttributesPage disabled={true}/>, getBaseState());

        const empty = await screen.findByText('No session attributes found.');
        expect(empty.closest('[aria-disabled="true"]')).toBeInTheDocument();
    });

    it('stages a TTL change and persists it on Save, reconciling the row', async () => {
        const patchPropertyField = jest.spyOn(Client4, 'patchPropertyField');
        getPropertyFields.mockResolvedValueOnce(representativeFields).mockResolvedValue([]);
        patchPropertyField.mockImplementation((_group, _objectType, fieldId, patch) => Promise.resolve({
            ...representativeFields[0],
            id: fieldId,
            attrs: {...representativeFields[0].attrs, ...(patch as {attrs: object}).attrs},
        } as UserPropertyField));

        renderWithContext(<SessionAttributesPage disabled={false}/>, getBaseState());

        await screen.findByText('Client IP');

        await userEvent.click(screen.getByTestId('session-attribute-dotmenu-session-ip_address'));
        await userEvent.hover(screen.getByRole('menuitem', {name: /Time-to-live/}));
        await userEvent.click(await screen.findByTestId('session-attribute-ttl-option-session-ip_address-3600'));

        const saveButton = screen.getByRole('button', {name: /Save/});
        expect(saveButton).toBeEnabled();

        const stagedRow = screen.getAllByText('Client IP')[0].closest('tr') as HTMLElement;
        expect(within(stagedRow).getByTestId('session-attribute-ttl')).toHaveTextContent('1h');

        await userEvent.click(saveButton);

        await waitFor(() => {
            expect(patchPropertyField).toHaveBeenCalledWith(
                SESSION_ATTRIBUTES_GROUP_ID,
                SESSION_ATTRIBUTES_OBJECT_TYPE,
                'session-ip_address',
                {attrs: {ttl_seconds: 3600}},
            );
        });

        await waitFor(() => {
            expect(screen.getByRole('button', {name: /Save/})).toBeDisabled();
        });

        const savedRow = screen.getAllByText('Client IP')[0].closest('tr') as HTMLElement;
        expect(within(savedRow).getByTestId('session-attribute-ttl')).toHaveTextContent('1h');
    });

    it('blocks navigation while dirty and clears the guard after a successful Save', async () => {
        const patchPropertyField = jest.spyOn(Client4, 'patchPropertyField');
        getPropertyFields.mockResolvedValueOnce(representativeFields).mockResolvedValue([]);
        patchPropertyField.mockImplementation((_group, _objectType, fieldId, patch) => Promise.resolve({
            ...representativeFields[0],
            id: fieldId,
            attrs: {...representativeFields[0].attrs, ...(patch as {attrs: object}).attrs},
        } as UserPropertyField));

        const {store} = renderWithContext(<SessionAttributesPage disabled={false}/>, getBaseState());

        await screen.findByText('Client IP');
        expect(store.getState().views.admin.navigationBlock.blocked).toBe(false);

        await userEvent.click(screen.getByTestId('session-attribute-dotmenu-session-ip_address'));
        await userEvent.hover(screen.getByRole('menuitem', {name: /Time-to-live/}));
        await userEvent.click(await screen.findByTestId('session-attribute-ttl-option-session-ip_address-3600'));

        await waitFor(() => {
            expect(store.getState().views.admin.navigationBlock.blocked).toBe(true);
        });

        await userEvent.click(screen.getByRole('button', {name: /Save/}));

        await waitFor(() => {
            expect(store.getState().views.admin.navigationBlock.blocked).toBe(false);
        });
    });

    it('reverts a staged edit and clears the nav guard when footer Cancel is clicked', async () => {
        getPropertyFields.mockResolvedValueOnce(representativeFields).mockResolvedValue([]);

        const {store} = renderWithContext(<SessionAttributesPage disabled={false}/>, getBaseState());

        await screen.findByText('Client IP');

        await userEvent.click(screen.getByTestId('session-attribute-dotmenu-session-ip_address'));
        await userEvent.hover(screen.getByRole('menuitem', {name: /Time-to-live/}));
        await userEvent.click(await screen.findByTestId('session-attribute-ttl-option-session-ip_address-3600'));

        const stagedRow = screen.getAllByText('Client IP')[0].closest('tr') as HTMLElement;
        expect(within(stagedRow).getByTestId('session-attribute-ttl')).toHaveTextContent('1h');
        expect(screen.getByRole('button', {name: /Save/})).toBeEnabled();

        await waitFor(() => {
            expect(store.getState().views.admin.navigationBlock.blocked).toBe(true);
        });

        // Footer Cancel must revert in place — no discard modal, no deferred navigation.
        await userEvent.click(screen.getByRole('button', {name: /Cancel/}));

        await waitFor(() => {
            const revertedRow = screen.getAllByText('Client IP')[0].closest('tr') as HTMLElement;
            expect(within(revertedRow).getByTestId('session-attribute-ttl')).toHaveTextContent('5m');
        });

        // Dirty state cleared, save bar disabled, and the navigation guard released —
        // without ever needing to confirm a deferred navigation.
        expect(screen.getByRole('button', {name: /Save/})).toBeDisabled();
        await waitFor(() => {
            expect(store.getState().views.admin.navigationBlock.blocked).toBe(false);
        });
        expect(store.getState().views.admin.navigationBlock.showNavigationPrompt).toBe(false);
    });
});
