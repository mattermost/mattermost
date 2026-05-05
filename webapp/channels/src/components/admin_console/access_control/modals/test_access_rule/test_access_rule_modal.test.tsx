// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {AccessControlPolicy} from '@mattermost/types/access_control';
import {POLICY_SIMULATION_BLAME_SOURCES} from '@mattermost/types/access_control';
import type {UserPropertyField} from '@mattermost/types/properties';
import {SESSION_ATTRIBUTES_GROUP_ID} from '@mattermost/types/properties';

import {act, fireEvent, renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import TestAccessRuleModal from './test_access_rule_modal';

const mockSimulatePolicyForUsers = jest.fn();
const mockSearchProfiles = jest.fn();

jest.mock('mattermost-redux/actions/access_control', () => ({
    simulatePolicyForUsers: (params: any) => () => mockSimulatePolicyForUsers(params),
}));

jest.mock('mattermost-redux/actions/users', () => ({
    searchProfiles: (term: string, opts: any) => () => mockSearchProfiles(term, opts),
}));

// Flatten Menu.Container to render its menu body inline. The picker uses
// Menu.Container both for the "+ Add users" popover and the per-row "gear"
// configure panel; jsdom + portal-based menus make it awkward to drive
// either through user events. The flattening keeps the tests focused on
// behaviour (search → add → simulate → render chip) instead of menu
// open/close orchestration.
jest.mock('components/menu', () => ({
    Container: ({menuButton, children}: any) => (
        <>
            <button
                data-testid={menuButton.id}
                aria-label={menuButton['aria-label']}
            >
                {menuButton.children}
            </button>
            <div data-testid={`${menuButton.id}-menu`}>{children}</div>
        </>
    ),
}));

const draftPolicy: AccessControlPolicy = {
    id: 'p1',
    name: 'p1',
    type: 'channel',
    rules: [{
        name: 'rule1',
        role: 'channel_user',
        actions: ['upload_file_attachment'],
        expression: 'true',
    }],
};

// One session-attribute property field is enough to flip the picker into
// "session controls visible" mode (gear icon + Use active session
// checkbox). Tests that don't set this prop verify the default-hidden
// behaviour.
const sessionAttribute: UserPropertyField = {
    id: 'sf1',
    group_id: SESSION_ATTRIBUTES_GROUP_ID,
    name: 'network_status',
    type: 'select',
    target_id: '',
    target_type: 'user',
    object_type: 'user',
    create_at: 0,
    update_at: 0,
    delete_at: 0,
    created_by: '',
    updated_by: '',
    attrs: {
        sort_order: 0,
        visibility: 'always',
        value_type: '',
    },
};

describe('TestAccessRuleModal — picker UX', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Default: empty user search
        mockSearchProfiles.mockResolvedValue({data: []});
        mockSimulatePolicyForUsers.mockResolvedValue({data: {results: [], total: 0}});
    });

    it('renders the empty state and the Add users button', async () => {
        renderWithContext(
            <TestAccessRuleModal
                onExited={jest.fn()}
                policy={draftPolicy}
                actions={['upload_file_attachment']}
                ruleName='rule1'
                targetRole='channel_user'
                targetScope='channel'
            />,
        );

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        // Subheader copy + empty-state copy both render the same line.
        expect(screen.getAllByText(/Pick users to dry-run/i).length).toBeGreaterThanOrEqual(1);
        expect(screen.getByRole('button', {name: /Add users/i})).toBeInTheDocument();
    });

    it('does not call simulator when no users are picked yet', async () => {
        renderWithContext(
            <TestAccessRuleModal
                onExited={jest.fn()}
                policy={draftPolicy}
                actions={['upload_file_attachment']}
                ruleName='rule1'
                targetRole='channel_user'
                targetScope='channel'
            />,
        );

        // Wait past the debounce window without any picker interaction.
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 350));
        });

        expect(mockSimulatePolicyForUsers).not.toHaveBeenCalled();
    });

    async function pickUser(user: any) {
        // Drive the inline searcher: open the popover → set the search
        // term → wait for the debounced dispatch → click the result.
        await userEvent.click(screen.getByRole('button', {name: /Add users/i}));

        // The shared Input widget hides the placeholder attribute while
        // the field is focused (the floating label takes over) so we look
        // it up by aria-label, which is set unconditionally.
        const searchInput = await screen.findByLabelText(/Search by name or email/i) as HTMLInputElement;

        // We use fireEvent.change instead of userEvent.type to avoid the
        // floating-ui useDismiss listener treating the per-key pointer
        // dance as an outside-press in jsdom. fireEvent dispatches a
        // single synthetic change which the picker's debounced search
        // effect picks up just like a real user typing the full term in
        // one go would.
        fireEvent.change(searchInput, {target: {value: user.username}});

        // Wait long enough for the picker's 200ms debounce + the
        // dispatched mock search promise to resolve into setResults.
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 350));
        });

        // The accessible name of each result button is the concatenation
        // of its child spans (display name + handle/email line). Username
        // appears in the handle span as @username, so a regex on the
        // username matches reliably regardless of full-name presence.
        const resultButton = await screen.findByRole(
            'button',
            {name: new RegExp(user.username)},
            {timeout: 3000},
        );
        await userEvent.click(resultButton);
    }

    it('dispatches simulatePolicyForUsers when a user is added, and re-dispatches when Use active session toggles', async () => {
        const user = TestHelper.getUserMock({id: 'u1', username: 'alpha', roles: 'system_user'});
        mockSearchProfiles.mockResolvedValue({data: [user]});
        mockSimulatePolicyForUsers.mockResolvedValue({
            data: {
                results: [{
                    user,
                    decisions: {
                        upload_file_attachment: {
                            decision: false,
                            blame: [{source: POLICY_SIMULATION_BLAME_SOURCES.THIS_RULE, rule_name: 'rule1'}],
                        },
                    },
                }],
                total: 1,
            },
        });

        renderWithContext(
            <TestAccessRuleModal
                onExited={jest.fn()}
                policy={draftPolicy}
                actions={['upload_file_attachment']}
                ruleName='rule1'
                targetRole='system_user'
                targetScope='system'
                accessControlFields={[sessionAttribute]}
            />,
        );

        await pickUser(user);

        await waitFor(() => {
            expect(mockSimulatePolicyForUsers).toHaveBeenCalled();
        }, {timeout: 2000});

        const initialCall = mockSimulatePolicyForUsers.mock.calls.at(-1)?.[0];
        expect(initialCall?.actions).toEqual(['upload_file_attachment']);
        expect(initialCall?.rule_name).toBe('rule1');
        expect(initialCall?.users?.[0]?.user_id).toBe(user.id);
        expect(initialCall?.users?.[0]?.use_active_session).toBeUndefined();

        // Toggle Use active session → simulator re-dispatches with the
        // override on, scoped to the user's row only.
        const toggle = await screen.findByTestId('test-rule-row-use-active-session');
        await userEvent.click(toggle);
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 350));
        });

        const lastCall = mockSimulatePolicyForUsers.mock.calls.at(-1)?.[0];
        expect(lastCall?.users?.[0]?.use_active_session).toBe(true);
    });

    it('exposes the gear-icon configure panel with the coming-soon stub copy when session attributes are configured', async () => {
        const user = TestHelper.getUserMock({id: 'u3', username: 'gamma', roles: 'system_user'});
        mockSearchProfiles.mockResolvedValue({data: [user]});
        mockSimulatePolicyForUsers.mockResolvedValue({
            data: {
                results: [{user, decisions: {upload_file_attachment: {decision: true}}}],
                total: 1,
            },
        });

        renderWithContext(
            <TestAccessRuleModal
                onExited={jest.fn()}
                policy={draftPolicy}
                actions={['upload_file_attachment']}
                ruleName='rule1'
                targetRole='system_user'
                targetScope='system'
                accessControlFields={[sessionAttribute]}
            />,
        );

        await pickUser(user);

        const panel = await screen.findByTestId('test-rule-row-configure');
        expect(panel).toBeInTheDocument();
        expect(panel).toHaveTextContent(/coming soon/i);
    });

    it('collapses multi-action results into a single Mixed chip and opens the breakdown modal on click', async () => {
        const user = TestHelper.getUserMock({id: 'umix', username: 'mixie', roles: 'system_user'});
        mockSearchProfiles.mockResolvedValue({data: [user]});
        mockSimulatePolicyForUsers.mockResolvedValue({
            data: {
                results: [{
                    user,
                    decisions: {
                        upload_file_attachment: {decision: true},
                        download_file_attachment: {
                            decision: false,
                            blame: [{source: POLICY_SIMULATION_BLAME_SOURCES.THIS_RULE, rule_name: 'rule1'}],
                        },
                    },
                }],
                total: 1,
            },
        });

        renderWithContext(
            <TestAccessRuleModal
                onExited={jest.fn()}
                policy={draftPolicy}
                actions={['upload_file_attachment', 'download_file_attachment']}
                ruleName='rule1'
                targetRole='system_user'
                targetScope='system'
                actionLabels={{
                    upload_file_attachment: 'Upload',
                    download_file_attachment: 'Download',
                }}
            />,
        );

        await pickUser(user);

        // Aggregate chip renders Mixed instead of two separate chips.
        const stacked = await screen.findByTestId('test-rule-row-chip-stacked-mixed');
        expect(stacked).toHaveTextContent(/Mixed/i);
        expect(screen.queryByTestId('test-rule-row-chip-allow')).not.toBeInTheDocument();
        expect(screen.queryByTestId('test-rule-row-chip-deny')).not.toBeInTheDocument();

        await userEvent.click(stacked);

        // Breakdown modal lists each permission with its own chip.
        const uploadRow = await screen.findByTestId('test-rule-breakdown-upload_file_attachment');
        expect(uploadRow).toHaveTextContent(/Upload/);
        const downloadRow = screen.getByTestId('test-rule-breakdown-download_file_attachment');
        expect(downloadRow).toHaveTextContent(/Download/);

        // Per-action chips inside the breakdown reflect the individual
        // verdicts (one allow, one deny with this-rule blame).
        expect(screen.getByTestId('test-rule-row-chip-allow')).toBeInTheDocument();
        expect(screen.getByTestId('test-rule-row-chip-deny')).toBeInTheDocument();
    });

    it('hides the gear icon and Use active session checkbox when no session attribute fields are configured', async () => {
        const user = TestHelper.getUserMock({id: 'u4', username: 'delta', roles: 'system_user'});
        mockSearchProfiles.mockResolvedValue({data: [user]});
        mockSimulatePolicyForUsers.mockResolvedValue({
            data: {
                results: [{user, decisions: {upload_file_attachment: {decision: true}}}],
                total: 1,
            },
        });

        renderWithContext(
            <TestAccessRuleModal
                onExited={jest.fn()}
                policy={draftPolicy}
                actions={['upload_file_attachment']}
                ruleName='rule1'
                targetRole='system_user'
                targetScope='system'

                // No accessControlFields prop → controls hidden.
            />,
        );

        await pickUser(user);

        // Wait for the row to render (close button is unconditional).
        await screen.findByRole('button', {name: /Remove user/i});

        expect(screen.queryByTestId('test-rule-row-use-active-session')).not.toBeInTheDocument();
        expect(screen.queryByTestId('test-rule-row-configure')).not.toBeInTheDocument();
    });
});
