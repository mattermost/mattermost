// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {AccessControlSettings} from '@mattermost/types/config';

import {useChannelAccessControlActions} from 'hooks/useChannelAccessControlActions';
import {renderWithContext, screen} from 'tests/react_testing_utils';

import PermissionPolicyDetails from './permission_policy_details';

jest.mock('utils/browser_history', () => ({
    getHistory: () => ({
        push: jest.fn(),
    }),
}));

// Render the editors as identifiable stand-ins. The real CELEditor boots
// Monaco (unavailable in JSDOM) and the real TableEditor parses CEL via an
// async action, neither of which is relevant here: these tests assert which
// editor the parent chooses on load. The shared isSimpleExpression helper is
// intentionally left unmocked so the real classification runs.
jest.mock('../../access_control/editors/table_editor/table_editor', () => {
    const reactLib = require('react');
    return jest.fn(() => reactLib.createElement('div', {'data-testid': 'table-editor'}));
});

jest.mock('../../access_control/editors/cel_editor/editor', () => {
    const reactLib = require('react');
    return jest.fn(() => reactLib.createElement('div', {'data-testid': 'cel-editor'}));
});

jest.mock('hooks/useChannelAccessControlActions', () => ({
    useChannelAccessControlActions: jest.fn(),
}));

const mockUseChannelAccessControlActions = useChannelAccessControlActions as jest.MockedFunction<typeof useChannelAccessControlActions>;

describe('components/admin_console/permission_policies/policy_details/PermissionPolicyDetails', () => {
    const mockFetchPolicy = jest.fn();
    const mockGetAccessControlFields = jest.fn();

    const accessControlSettings: AccessControlSettings = {
        EnableAttributeBasedAccessControl: true,
        EnableUserManagedAttributes: false,
        TrustProxyDeviceIdentityHeader: false,
        EnforceDeviceIDConsistency: false,
    };

    const baseProps = {
        policyId: 'policy1',
        accessControlSettings,
        sessionAttributesEnabled: false,
        actions: {
            fetchPolicy: mockFetchPolicy,
            createPolicy: jest.fn(),
            deletePolicy: jest.fn(),
            setNavigationBlocked: jest.fn(),
        },
    };

    const renderWithExpression = (expression: string) => {
        mockFetchPolicy.mockResolvedValue({
            data: {
                id: 'policy1',
                name: 'Policy 1',
                roles: ['system_user'],
                rules: expression ? [{actions: ['download_file_attachment'], expression}] : [],
            },
        });
        return renderWithContext(<PermissionPolicyDetails {...baseProps}/>);
    };

    beforeEach(() => {
        mockFetchPolicy.mockReset();
        mockGetAccessControlFields.mockReset();

        mockUseChannelAccessControlActions.mockReturnValue({
            getAccessControlFields: mockGetAccessControlFields,
            getVisualAST: jest.fn(),
            searchUsers: jest.fn(),
            getChannelPolicy: jest.fn(),
            saveChannelPolicy: jest.fn(),
            deleteChannelPolicy: jest.fn(),
            getChannelMembers: jest.fn(),
            createJob: jest.fn(),
            createAccessControlSyncJob: jest.fn(),
            validateExpressionAgainstRequester: jest.fn(),
            simulatePolicyForUsers: jest.fn(),
            updateAccessControlPoliciesActive: jest.fn(),
        });

        // One LDAP-synced attribute keeps the editor usable so the mode toggle
        // is enabled and reflects the loaded expression rather than the
        // no-attributes gate.
        mockGetAccessControlFields.mockResolvedValue({data: [{name: 'teams', attrs: {ldap: true}}]});
    });

    // MM-69527: editing an existing rule must default to Simple (table) mode
    // for every expression the simple editor can represent. The two named
    // cases below are the original regression: a parenthesized multiselect
    // "has any of" OR-group and a ranked-operator condition were misclassified
    // as complex by a stale local helper and forced the editor into Advanced
    // mode.
    test('opens a multiselect "has any of" group in Simple mode (MM-69527)', async () => {
        renderWithExpression('user.attributes.department == "engineering" && ("engineering" in user.attributes.teams || "sales" in user.attributes.teams)');

        expect(await screen.findByTestId('table-editor')).toBeInTheDocument();
        expect(screen.queryByTestId('cel-editor')).not.toBeInTheDocument();
        expect(screen.getByText('Switch to Advanced Mode')).toBeInTheDocument();
    });

    test('opens a ranked-operator rule in Simple mode (MM-69527)', async () => {
        renderWithExpression('user.attributes.level >= "Senior"');

        expect(await screen.findByTestId('table-editor')).toBeInTheDocument();
        expect(screen.queryByTestId('cel-editor')).not.toBeInTheDocument();
        expect(screen.getByText('Switch to Advanced Mode')).toBeInTheDocument();
    });

    describe('opens simple expressions in Simple (table) mode', () => {
        const simpleExpressions: Array<[string, string]> = [
            ['empty expression (new rule)', ''],
            ['equality', 'user.attributes.teams == "engineering"'],
            ['inequality', 'user.attributes.teams != "engineering"'],
            ['ranked is at most (<=)', 'user.attributes.level <= "Senior"'],
            ['ranked greater than (>)', 'user.attributes.level > "Junior"'],
            ['ranked less than (<)', 'user.attributes.level < "Lead"'],
            ['has all of (&&-joined "in")', '"engineering" in user.attributes.teams && "sales" in user.attributes.teams'],
            ['attribute in list', 'user.attributes.teams in ["engineering", "sales"]'],
            ['startsWith', 'user.attributes.email.startsWith("admin")'],
            ['endsWith', 'user.attributes.email.endsWith("@acme.com")'],
            ['contains', 'user.attributes.email.contains("acme")'],
        ];

        test.each(simpleExpressions)('%s', async (_label, expression) => {
            renderWithExpression(expression);

            expect(await screen.findByTestId('table-editor')).toBeInTheDocument();
            expect(screen.queryByTestId('cel-editor')).not.toBeInTheDocument();
        });
    });

    describe('opens complex expressions in Advanced (CEL) mode', () => {
        const complexExpressions: Array<[string, string]> = [
            ['top-level OR of equalities', 'user.attributes.a == "x" || user.attributes.b == "y"'],
            ['parenthesized OR of equalities', 'user.attributes.a == "x" && (user.attributes.b == "y" || user.attributes.c == "z")'],
        ];

        test.each(complexExpressions)('%s', async (_label, expression) => {
            renderWithExpression(expression);

            expect(await screen.findByTestId('cel-editor')).toBeInTheDocument();
            expect(screen.queryByTestId('table-editor')).not.toBeInTheDocument();
        });
    });

    test('disables the mode toggle when a complex expression forces Advanced mode', async () => {
        renderWithExpression('user.attributes.a == "x" || user.attributes.b == "y"');

        const toggle = await screen.findByText('Switch to Simple Mode');
        expect(toggle.closest('button')).toBeDisabled();
    });
});
