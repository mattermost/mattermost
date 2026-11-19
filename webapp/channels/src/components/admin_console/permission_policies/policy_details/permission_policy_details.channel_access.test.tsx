// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import PermissionPolicyDetails from './permission_policy_details';
import {
    E,
    baseProps,
    mockCreatePolicy,
    renderWithPolicy,
    setUpPolicyDetailsMocks,
} from './test_utils';

jest.mock('utils/browser_history', () => ({
    getHistory: () => ({push: jest.fn()}),
}));

jest.mock('hooks/useEnabledSessionAttributeFields', () => ({
    useEnabledSessionAttributeFields: jest.fn(() => []),
}));

// Stand-ins: the real CELEditor boots Monaco (unavailable in JSDOM) and the
// real TableEditor parses CEL through an async action.
jest.mock('../../access_control/editors/table_editor/table_editor', () => {
    const reactLib = require('react');
    return jest.fn(() => reactLib.createElement('div', {'data-testid': 'table-editor'}));
});

jest.mock('../../access_control/editors/cel_editor/editor', () => {
    const reactLib = require('react');
    return jest.fn(() => reactLib.createElement('div', {'data-testid': 'cel-editor'}));
});

jest.mock('components/admin_console/access_control/modals/simulate_access/simulate_access_modal', () => {
    const reactLib = require('react');
    return jest.fn(() => reactLib.createElement('div', {'data-testid': 'simulate-modal'}));
});

jest.mock('hooks/useChannelAccessControlActions', () => ({
    useChannelAccessControlActions: jest.fn(),
}));

describe('components/admin_console/permission_policies/policy_details/PermissionPolicyDetails — Channel Read Access', () => {
    let checkExpressionSpy: jest.SpyInstance;

    const baseState = {
        entities: {
            general: {
                config: {
                    FeatureFlagPermissionPolicies: 'true',
                    FeatureFlagChannelPermissionActions: 'true',
                },
            },
        },
    };

    beforeEach(() => {
        checkExpressionSpy = setUpPolicyDetailsMocks();
        mockCreatePolicy.mockResolvedValue({data: {id: 'policy1'}});
    });

    afterEach(() => {
        checkExpressionSpy.mockRestore();
        jest.clearAllMocks();
    });

    // Seed a saved file-only policy so the editor loads with a name, an
    // expression and one permission already selected.
    const renderAndOpenMenu = async () => {
        renderWithPolicy({expressions: [E]}, baseState);
        await screen.findByText('Add permission');
        await userEvent.click(document.getElementById('pp-add-permission-btn')!);
    };

    // Menu.Item runs its onClick only after the menu's close animation
    // finishes (see addOnClosedListener in menu_item.tsx), so the permission
    // lands in state a tick after the click. Wait for Save to enable.
    const pickPermission = async (label: string) => {
        await userEvent.click(screen.getByRole('menuitem', {name: new RegExp(label)}));
        await waitFor(() => {
            expect(screen.getByText('Save').closest('button')).toBeEnabled();
        });
    };

    test('offers Channel Read Access in the permission menu', async () => {
        await renderAndOpenMenu();

        expect(document.getElementById('pp-add-permission-channel_read_access')).not.toBeNull();
        expect(document.getElementById('pp-add-permission-upload_file_attachment')).not.toBeNull();
    });

    test('does not offer the channel access actions while the ChannelPermissionActions flag is off', async () => {
        const flagOffState = {entities: {general: {config: {FeatureFlagPermissionPolicies: 'true'}}}};
        renderWithContext(<PermissionPolicyDetails {...baseProps}/>, flagOffState);
        await screen.findByText('Add permission');
        await userEvent.click(document.getElementById('pp-add-permission-btn')!);

        expect(document.getElementById('pp-add-permission-upload_file_attachment')).not.toBeNull();
        expect(document.getElementById('pp-add-permission-channel_read_access')).toBeNull();
        expect(document.getElementById('pp-add-permission-channel_write_access')).toBeNull();
        expect(document.getElementById('pp-add-permission-channel_management_access')).toBeNull();
    });

    test('confirms before saving a policy that carries channel_read_access', async () => {
        await renderAndOpenMenu();
        await pickPermission('Channel Read Access');

        await userEvent.click(screen.getByText('Save'));

        expect(await screen.findByText('Save this policy?')).toBeInTheDocument();
        expect(mockCreatePolicy).not.toHaveBeenCalled();

        await userEvent.click(screen.getByRole('button', {name: 'Save policy'}));

        await waitFor(() => {
            expect(mockCreatePolicy).toHaveBeenCalledTimes(1);
        });
        expect(mockCreatePolicy.mock.calls[0][0].rules[0].actions).toEqual(
            expect.arrayContaining(['download_file_attachment', 'channel_read_access']),
        );
    });

    test('confirms before saving a policy that carries channel_management_access', async () => {
        await renderAndOpenMenu();
        await pickPermission('Manage Channel');

        await userEvent.click(screen.getByText('Save'));

        expect(await screen.findByText('Save this policy?')).toBeInTheDocument();
        expect(screen.getByText('This policy controls Manage Channel across every channel in the workspace, except direct messages and group messages.')).toBeInTheDocument();
        expect(mockCreatePolicy).not.toHaveBeenCalled();

        await userEvent.click(screen.getByRole('button', {name: 'Save policy'}));

        await waitFor(() => {
            expect(mockCreatePolicy).toHaveBeenCalledTimes(1);
        });
        expect(mockCreatePolicy.mock.calls[0][0].rules[0].actions).toEqual(
            expect.arrayContaining(['channel_management_access']),
        );
    });

    test('cancelling the confirmation leaves the policy unsaved', async () => {
        await renderAndOpenMenu();
        await pickPermission('Channel Read Access');

        await userEvent.click(screen.getByText('Save'));
        await screen.findByText('Save this policy?');
        await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

        expect(mockCreatePolicy).not.toHaveBeenCalled();
    });

    test('a file-only policy saves without the confirmation', async () => {
        await renderAndOpenMenu();
        await pickPermission('Upload Files');

        await userEvent.click(screen.getByText('Save'));

        await waitFor(() => {
            expect(mockCreatePolicy).toHaveBeenCalledTimes(1);
        });
        expect(screen.queryByText('Save this policy?')).not.toBeInTheDocument();
    });
});
