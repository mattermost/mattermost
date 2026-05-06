// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {AccessControlPolicy} from '@mattermost/types/access_control';
import {POLICY_SIMULATION_BLAME_SOURCES} from '@mattermost/types/access_control';
import type {UserPropertyField} from '@mattermost/types/properties';
import {SESSION_ATTRIBUTES_GROUP_ID} from '@mattermost/types/properties';

import {act, fireEvent, renderWithContext, screen, userEvent, waitFor, within} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import SimulateAccessModal from './simulate_access_modal';

const mockSimulatePolicyForUsers = jest.fn();
const mockSearchProfiles = jest.fn();
const mockGetProfilesInChannel = jest.fn();
const mockGetProfiles = jest.fn();

jest.mock('mattermost-redux/actions/access_control', () => ({
    simulatePolicyForUsers: (params: any) => () => mockSimulatePolicyForUsers(params),
}));

jest.mock('mattermost-redux/actions/users', () => ({
    searchProfiles: (term: string, opts: any) => () => mockSearchProfiles(term, opts),
    getProfilesInChannel: (channelId: string, page: number, perPage: number) => () => mockGetProfilesInChannel(channelId, page, perPage),
    getProfiles: (page: number, perPage: number, opts: any) => () => mockGetProfiles(page, perPage, opts),
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

// One session-attribute property field with a select+options list is
// enough to flip the picker into "session controls visible" mode (the
// pencil button is rendered) and to give the editor form one dropdown
// to render.
const sessionAttribute: UserPropertyField = {
    id: 'sf1',
    group_id: SESSION_ATTRIBUTES_GROUP_ID,
    name: 'network',
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
        options: [
            {id: 'wifi', name: 'WiFi', color: ''},
            {id: 'vpn', name: 'VPN', color: ''},
        ],
    },
};

describe('SimulateAccessModal — picker UX', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        mockSearchProfiles.mockResolvedValue({data: []});
        mockGetProfilesInChannel.mockResolvedValue({data: []});
        mockGetProfiles.mockResolvedValue({data: []});
        mockSimulatePolicyForUsers.mockResolvedValue({data: {results: [], total: 0}});
    });

    it('renders the empty state, the Add users button, and the scope toggle defaulting to "All policies"', async () => {
        renderWithContext(
            <SimulateAccessModal
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

        expect(screen.getByRole('button', {name: /Add users/i})).toBeInTheDocument();
        expect(screen.getByTestId('simulate-access-scope-all')).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByTestId('simulate-access-scope-this-rule')).toHaveAttribute('aria-pressed', 'false');

        // Permission filter only renders for multi-action rules. With
        // a single action there's nothing to filter, so the dropdown
        // is intentionally hidden.
        expect(screen.queryByTestId('simulate-access-permission-filter')).not.toBeInTheDocument();
    });

    it('does not call simulator when no users are picked, and Re-run button is disabled', async () => {
        renderWithContext(
            <SimulateAccessModal
                onExited={jest.fn()}
                policy={draftPolicy}
                actions={['upload_file_attachment']}
                ruleName='rule1'
                targetRole='channel_user'
                targetScope='channel'
            />,
        );

        // Without picking any user, no simulate dispatch happens — even
        // after waiting (manual-only re-run; nothing is on a timer).
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 50));
        });
        expect(mockSimulatePolicyForUsers).not.toHaveBeenCalled();

        const rerun = screen.getByRole('button', {name: /Re-run/i});
        expect(rerun).toBeDisabled();
    });

    async function pickUser(user: any) {
        await userEvent.click(screen.getByRole('button', {name: /Add users/i}));

        const searchInput = await screen.findByLabelText(/Search by name or email/i) as HTMLInputElement;

        // fireEvent.change avoids floating-ui useDismiss treating the
        // per-key pointer dance as an outside-press in jsdom; one
        // synthetic change drives the picker's debounced search effect.
        fireEvent.change(searchInput, {target: {value: user.username}});

        // Wait for the picker's search debounce + the dispatched mock
        // search promise to resolve into setResults.
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 350));
        });

        const resultButton = await screen.findByRole(
            'button',
            {name: new RegExp(user.username)},
            {timeout: 3000},
        );
        await userEvent.click(resultButton);
    }

    it('auto-runs the simulator when a user is picked, with the scope param', async () => {
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
            <SimulateAccessModal
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

        // Picking a user auto-fires simulate (no explicit Re-run click
        // needed) — that's the most common state change and the row
        // would otherwise sit in pristine "no chip" state.
        await waitFor(() => {
            expect(mockSimulatePolicyForUsers).toHaveBeenCalled();
        });

        const call = mockSimulatePolicyForUsers.mock.calls.at(-1)?.[0];
        expect(call?.actions).toEqual(['upload_file_attachment']);
        expect(call?.rule_name).toBe('rule1');
        expect(call?.users?.[0]?.user_id).toBe(user.id);
        expect(call?.evaluation_scope).toBe('all');
    });

    it('auto-reruns the simulator with the new scope when the toggle is clicked', async () => {
        const user = TestHelper.getUserMock({id: 'u1', username: 'alpha', roles: 'system_user'});
        mockSearchProfiles.mockResolvedValue({data: [user]});

        renderWithContext(
            <SimulateAccessModal
                onExited={jest.fn()}
                policy={draftPolicy}
                actions={['upload_file_attachment']}
                ruleName='rule1'
                targetRole='system_user'
                targetScope='system'
            />,
        );

        await pickUser(user);

        // Picking the user fires the first simulate (scope: all).
        await waitFor(() => {
            expect(mockSimulatePolicyForUsers).toHaveBeenCalled();
        });
        const initialCalls = mockSimulatePolicyForUsers.mock.calls.length;
        expect(mockSimulatePolicyForUsers.mock.calls.at(-1)?.[0]?.evaluation_scope).toBe('all');

        // Toggling the scope must immediately fire a fresh simulate
        // with the new scope param — no extra Re-run click needed.
        await userEvent.click(screen.getByTestId('simulate-access-scope-this-rule'));
        expect(screen.getByTestId('simulate-access-scope-this-rule')).toHaveAttribute('aria-pressed', 'true');

        await waitFor(() => {
            expect(mockSimulatePolicyForUsers.mock.calls.length).toBeGreaterThan(initialCalls);
        });
        expect(mockSimulatePolicyForUsers.mock.calls.at(-1)?.[0]?.evaluation_scope).toBe('this_rule');

        // Toggling back to All policies fires another rerun with the
        // original scope, confirming both directions work.
        const afterFirstToggle = mockSimulatePolicyForUsers.mock.calls.length;
        await userEvent.click(screen.getByTestId('simulate-access-scope-all'));
        await waitFor(() => {
            expect(mockSimulatePolicyForUsers.mock.calls.length).toBeGreaterThan(afterFirstToggle);
        });
        expect(mockSimulatePolicyForUsers.mock.calls.at(-1)?.[0]?.evaluation_scope).toBe('all');
    });

    it('does not call the simulator when the scope toggle is clicked but no users have been picked', async () => {
        renderWithContext(
            <SimulateAccessModal
                onExited={jest.fn()}
                policy={draftPolicy}
                actions={['upload_file_attachment']}
                ruleName='rule1'
                targetRole='system_user'
                targetScope='system'
            />,
        );

        await userEvent.click(screen.getByTestId('simulate-access-scope-this-rule'));
        expect(screen.getByTestId('simulate-access-scope-this-rule')).toHaveAttribute('aria-pressed', 'true');

        // The toggle still updates UI state but skips the dispatch
        // when there's nothing to evaluate.
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 50));
        });
        expect(mockSimulatePolicyForUsers).not.toHaveBeenCalled();
    });

    it('expands the row to show per-session decisions when the response carries sessions[]', async () => {
        const user = TestHelper.getUserMock({id: 'u2', username: 'leonard', roles: 'system_user'});
        mockSearchProfiles.mockResolvedValue({data: [user]});
        mockSimulatePolicyForUsers.mockResolvedValue({
            data: {
                results: [{
                    user,
                    decisions: {upload_file_attachment: {decision: true}},
                    sessions: [
                        {
                            id: 's1',
                            device: 'MacBook Pro',
                            network: 'WiFi',
                            last_active_at: Date.now() - 32_000,
                            decisions: {upload_file_attachment: {decision: true}},
                        },
                        {
                            id: 's2',
                            device: 'iPhone 14',
                            network: 'WiFi',
                            last_active_at: Date.now() - 240_000,
                            decisions: {
                                upload_file_attachment: {
                                    decision: false,
                                    blame: [{source: POLICY_SIMULATION_BLAME_SOURCES.THIS_RULE}],
                                },
                            },
                        },
                    ],
                }],
                total: 1,
            },
        });

        renderWithContext(
            <SimulateAccessModal
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
        await userEvent.click(screen.getByRole('button', {name: /Re-run/i}));

        // Recent activity reads "1 of 2 sessions" because one session
        // denied; clicking the row expands the per-session breakdown.
        // The column itself only renders when session attributes are
        // configured, hence the accessControlFields prop above.
        const activityCell = await screen.findByText(/1 of 2 sessions/i);
        expect(activityCell).toBeInTheDocument();

        await userEvent.click(activityCell);

        const sessionRows = await screen.findAllByTestId('simulate-access-session-row');
        expect(sessionRows).toHaveLength(2);
        expect(screen.getByText(/MacBook Pro · WiFi/i)).toBeInTheDocument();
        expect(screen.getByText(/iPhone 14 · WiFi/i)).toBeInTheDocument();
    });

    it('permission filter narrows multi-action rows to a single permission and updates the summary', async () => {
        const user = TestHelper.getUserMock({id: 'umix', username: 'mix', roles: 'system_user'});
        mockSearchProfiles.mockResolvedValue({data: [user]});

        // Upload denies, download allows — the aggregate is "mixed",
        // and the permission filter should be able to collapse the row
        // down to either side.
        mockSimulatePolicyForUsers.mockResolvedValue({
            data: {
                results: [{
                    user,
                    decisions: {
                        upload_file_attachment: {
                            decision: false,
                            blame: [{source: POLICY_SIMULATION_BLAME_SOURCES.THIS_RULE, rule_name: 'rule1'}],
                        },
                        download_file_attachment: {decision: true},
                    },
                }],
                total: 1,
            },
        });

        renderWithContext(
            <SimulateAccessModal
                onExited={jest.fn()}
                policy={draftPolicy}
                actions={['upload_file_attachment', 'download_file_attachment']}
                actionLabels={{
                    upload_file_attachment: 'Upload files',
                    download_file_attachment: 'Download files',
                }}
                ruleName='rule1'
                targetRole='system_user'
                targetScope='system'
            />,
        );

        await pickUser(user);
        await userEvent.click(screen.getByRole('button', {name: /Re-run/i}));

        // Permission filter is rendered (multi-action rule). Default
        // label is "All permissions" → mixed aggregate chip.
        const filterButton = await screen.findByTestId('simulate-access-permission-filter');
        expect(filterButton).toHaveTextContent(/All permissions/);
        await screen.findByText(/Mixed/i);
        expect(screen.getByTestId('simulate-access-summary')).toHaveTextContent(/1 user · 0 allowed · 1 denied/);

        // Select "Download files" → only the allowed verdict is
        // shown; the row chip flips to allow and the summary tally
        // rebalances.
        await userEvent.click(filterButton);
        await userEvent.click(await screen.findByRole('menuitemradio', {name: /Download files/i}));
        await screen.findByTestId('simulate-access-row-chip-allow');
        expect(screen.queryByText(/Mixed/i)).not.toBeInTheDocument();
        expect(screen.getByTestId('simulate-access-summary')).toHaveTextContent(/1 user · 1 allowed · 0 denied/);
        expect(filterButton).toHaveTextContent(/Download files/);

        // Switch to "Upload files" → row collapses to deny,
        // summary flips back.
        await userEvent.click(filterButton);
        await userEvent.click(await screen.findByRole('menuitemradio', {name: /Upload files/i}));
        await screen.findByTestId('simulate-access-row-chip-deny');
        expect(screen.getByTestId('simulate-access-summary')).toHaveTextContent(/1 user · 0 allowed · 1 denied/);
        expect(filterButton).toHaveTextContent(/Upload files/);
    });

    it('opens the pencil-icon editor with form fields driven by accessControlFields', async () => {
        const user = TestHelper.getUserMock({id: 'u3', username: 'gamma', roles: 'system_user'});
        mockSearchProfiles.mockResolvedValue({data: [user]});

        renderWithContext(
            <SimulateAccessModal
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

        const pencil = await screen.findByTestId(`simulate-access-row-edit-${user.id}`);
        await userEvent.click(pencil);

        const editor = await screen.findByTestId('simulate-access-row-editor');
        expect(editor).toBeInTheDocument();

        // The single configured field renders as a dropdown because it's
        // type=select with options. Setting it + Apply writes into the
        // row's session_overrides for the next Re-run.
        const select = editor.querySelector('select') as HTMLSelectElement;
        expect(select).toBeInTheDocument();
        fireEvent.change(select, {target: {value: 'WiFi'}});
        await userEvent.click(screen.getByRole('button', {name: /Apply/i}));

        await userEvent.click(screen.getByRole('button', {name: /Re-run/i}));

        await waitFor(() => {
            expect(mockSimulatePolicyForUsers).toHaveBeenCalled();
        });
        expect(mockSimulatePolicyForUsers.mock.calls.at(-1)?.[0]?.users?.[0]?.session_overrides).toEqual({network: 'WiFi'});
    });

    it('hides the pencil button and the Recent activity column when no session-attribute fields are configured', async () => {
        const user = TestHelper.getUserMock({id: 'u4', username: 'delta', roles: 'system_user'});
        mockSearchProfiles.mockResolvedValue({data: [user]});

        renderWithContext(
            <SimulateAccessModal
                onExited={jest.fn()}
                policy={draftPolicy}
                actions={['upload_file_attachment']}
                ruleName='rule1'
                targetRole='system_user'
                targetScope='system'

                // No accessControlFields prop → pencil hidden + the
                // Recent activity column is omitted entirely so the
                // result chip can hug the trailing remove button.
            />,
        );

        await pickUser(user);

        // Wait for the row to render (the remove button is unconditional).
        await screen.findByRole('button', {name: /Remove user/i});
        expect(screen.queryByTestId(`simulate-access-row-edit-${user.id}`)).not.toBeInTheDocument();

        // The "Recent activity" column header must not appear.
        expect(screen.queryByRole('columnheader', {name: /Recent activity/i})).not.toBeInTheDocument();
    });

    it('renders a 3-column table with Result adjacent to the remove button when no session-attribute fields are configured', async () => {
        const user = TestHelper.getUserMock({id: 'u5', username: 'epsilon', roles: 'system_user'});
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
            <SimulateAccessModal
                onExited={jest.fn()}
                policy={draftPolicy}
                actions={['upload_file_attachment']}
                ruleName='rule1'
                targetRole='system_user'
                targetScope='system'
            />,
        );

        await pickUser(user);

        // 3 column headers (User / Result / Actions sr-only) — no
        // Recent activity. The actions header has visually-hidden text
        // ("Actions") so the column is still announced to screen
        // readers, hence we can find all three with `getAllByRole`.
        await waitFor(() => {
            expect(screen.getAllByRole('columnheader')).toHaveLength(3);
        });

        // The data row should likewise have exactly 3 cells: user
        // identity, result chip, and the remove-button cell. This
        // guarantees Result and Remove are direct DOM neighbours so
        // the chip "hugs" the X.
        const rowCells = screen.getAllByRole('row')[1].querySelectorAll('td');
        expect(rowCells).toHaveLength(3);

        const denyChip = await screen.findByTestId('simulate-access-row-chip-deny');

        // Confirm DOM ordering: the deny chip must appear before the
        // remove-user button without any other cell between them.
        const removeButton = screen.getByRole('button', {name: /Remove user/i});
        const denyCell = denyChip.closest('td');
        const removeCell = removeButton.closest('td');
        expect(denyCell).not.toBeNull();
        expect(removeCell).not.toBeNull();
        expect(denyCell?.nextElementSibling).toBe(removeCell);
    });

    it('does not expand the row even when the response carries sessions[] if no session-attribute fields are configured', async () => {
        const user = TestHelper.getUserMock({id: 'u6', username: 'zeta', roles: 'system_user'});
        mockSearchProfiles.mockResolvedValue({data: [user]});

        // The backend SHOULD only return sessions[] when session
        // attributes are configured, but the picker treats the column
        // configuration (accessControlFields) as the source of truth so
        // a misbehaving server can't smuggle a misaligned 4-cell sub-
        // row into a 3-column table layout.
        mockSimulatePolicyForUsers.mockResolvedValue({
            data: {
                results: [{
                    user,
                    decisions: {upload_file_attachment: {decision: true}},
                    sessions: [
                        {
                            id: 's1',
                            device: 'Test Device',
                            decisions: {upload_file_attachment: {decision: true}},
                        },
                    ],
                }],
                total: 1,
            },
        });

        renderWithContext(
            <SimulateAccessModal
                onExited={jest.fn()}
                policy={draftPolicy}
                actions={['upload_file_attachment']}
                ruleName='rule1'
                targetRole='system_user'
                targetScope='system'

                // No accessControlFields prop → row is non-expandable
                // even though sessions[] came back.
            />,
        );

        await pickUser(user);

        const allowChip = await screen.findByTestId('simulate-access-row-chip-allow');
        expect(allowChip).toBeInTheDocument();

        // The user row should not advertise an expandable role; click
        // attempts must not reveal a session sub-row.
        const userRow = allowChip.closest('tr');
        expect(userRow).not.toBeNull();
        expect(userRow?.getAttribute('aria-expanded')).toBeNull();

        if (userRow) {
            await userEvent.click(userRow);
        }
        expect(screen.queryByTestId('simulate-access-session-row')).not.toBeInTheDocument();

        // Recent activity column / device label / chevron must all stay
        // out of the DOM since the entire concept is gated on session
        // attributes being configured.
        expect(screen.queryByText(/Test Device/)).not.toBeInTheDocument();
    });

    it('collapses multi-action results into a single Mixed chip and opens the decision details modal on click', async () => {
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
            <SimulateAccessModal
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
        await userEvent.click(screen.getByRole('button', {name: /Re-run/i}));

        const stacked = await screen.findByTestId('simulate-access-row-chip-stacked-mixed');
        expect(stacked).toHaveTextContent(/Mixed/i);

        await userEvent.click(stacked);

        const uploadRow = await screen.findByTestId('simulate-access-details-upload_file_attachment');
        expect(uploadRow).toHaveTextContent(/Upload/);
        const downloadRow = screen.getByTestId('simulate-access-details-download_file_attachment');
        expect(downloadRow).toHaveTextContent(/Download/);
        expect(screen.getByTestId('simulate-access-row-chip-allow')).toBeInTheDocument();
        expect(screen.getByTestId('simulate-access-row-chip-deny')).toBeInTheDocument();
    });

    it('makes a single-action deny chip clickable and renders the failing rule + expression in the details modal', async () => {
        const user = TestHelper.getUserMock({id: 'udeny', username: 'dee', roles: 'system_user'});
        mockSearchProfiles.mockResolvedValue({data: [user]});
        mockSimulatePolicyForUsers.mockResolvedValue({
            data: {
                results: [{
                    user,
                    decisions: {
                        upload_file_attachment: {
                            decision: false,
                            blame: [{
                                source: POLICY_SIMULATION_BLAME_SOURCES.THIS_RULE,
                                rule_name: 'rule1',

                                // Server enrichment normally fills this
                                // in for draft-side blame; we still
                                // exercise the client-side fallback path
                                // by leaving it blank — the modal looks
                                // up the expression in `policy.rules`.
                            }],
                        },
                    },
                    attributes: {region: 'eu', department: 'sales'},
                }],
                total: 1,
            },
        });

        const draftWithExpression: AccessControlPolicy = {
            ...draftPolicy,
            rules: [{
                name: 'rule1',
                role: 'system_user',
                actions: ['upload_file_attachment'],
                expression: 'user.attributes.region == "us"',
            }],
        };

        renderWithContext(
            <SimulateAccessModal
                onExited={jest.fn()}
                policy={draftWithExpression}
                actions={['upload_file_attachment']}
                ruleName='rule1'
                targetRole='system_user'
                targetScope='system'
            />,
        );

        await pickUser(user);

        const chipButton = await screen.findByTestId('simulate-access-row-chip-button');
        await userEvent.click(chipButton);

        // The rule details start collapsed behind a disclosure
        // toggle so the modal opens with a tight summary view; the
        // rule + expression block is only mounted once the toggle is
        // clicked.
        expect(screen.queryByTestId('simulate-access-details-rule-upload_file_attachment')).not.toBeInTheDocument();
        await userEvent.click(screen.getByTestId('simulate-access-details-toggle-upload_file_attachment'));

        const detailsRow = await screen.findByTestId('simulate-access-details-rule-upload_file_attachment');
        expect(detailsRow).toHaveTextContent(/rule1/);
        expect(detailsRow).toHaveTextContent('user.attributes.region == "us"');

        // Attribute snapshot block renders the user attributes the
        // simulator returned alongside the rule. The snapshot lives
        // OUTSIDE the disclosure so it's visible without expanding.
        const userAttrs = screen.getByTestId('simulate-access-details-user-attributes');
        expect(userAttrs).toHaveTextContent(/region/);
        expect(userAttrs).toHaveTextContent(/eu/);
        expect(userAttrs).toHaveTextContent(/department/);
        expect(userAttrs).toHaveTextContent(/sales/);
    });

    it('peer_policy blame surfaces the peer policy name on the chip and inside the details modal', async () => {
        const user = TestHelper.getUserMock({id: 'upeer', username: 'peer', roles: 'system_user'});
        mockSearchProfiles.mockResolvedValue({data: [user]});
        mockSimulatePolicyForUsers.mockResolvedValue({
            data: {
                results: [{
                    user,
                    decisions: {
                        upload_file_attachment: {
                            decision: false,
                            blame: [{
                                source: POLICY_SIMULATION_BLAME_SOURCES.PEER_POLICY,
                                policy_id: 'p2',
                                policy_name: 'IL5 Block',
                                rule_name: 'r2',
                                expression: 'user.attributes.clearance == "il5"',
                            }],
                        },
                    },
                }],
                total: 1,
            },
        });

        renderWithContext(
            <SimulateAccessModal
                onExited={jest.fn()}
                policy={draftPolicy}
                actions={['upload_file_attachment']}
                ruleName='rule1'
                targetRole='system_user'
                targetScope='system'
            />,
        );

        await pickUser(user);

        // Chip names the peer policy directly instead of falling back
        // to the generic "another policy" label.
        const chip = await screen.findByTestId('simulate-access-row-chip-deny');
        expect(chip).toHaveTextContent(/IL5 Block/);
        expect(chip).not.toHaveTextContent(/another policy/i);
        expect(chip).not.toHaveTextContent(/upper-scoped/i);

        // Details modal shows policy name + rule name + expression
        // — but only after expanding the per-row disclosure.
        const chipButton = screen.getByTestId('simulate-access-row-chip-button');
        await userEvent.click(chipButton);
        await userEvent.click(screen.getByTestId('simulate-access-details-toggle-upload_file_attachment'));

        const detailsRow = await screen.findByTestId('simulate-access-details-rule-upload_file_attachment');
        expect(detailsRow).toHaveTextContent(/IL5 Block/);
        expect(detailsRow).toHaveTextContent(/r2/);
        expect(detailsRow).toHaveTextContent('user.attributes.clearance == "il5"');
    });

    it('renders the evaluation tree with outcome chips when blame.evaluation_tree is present', async () => {
        const user = TestHelper.getUserMock({id: 'utree', username: 'tree', roles: 'system_user'});
        mockSearchProfiles.mockResolvedValue({data: [user]});

        // Two-clause AND where the region clause passes but the
        // clearance clause fails. The walker mirrors that: root AND
        // outcome=false, child[0] outcome=true (region matched), child[1]
        // outcome=false (clearance mismatch). The renderer surfaces
        // each leaf's actual / expected value.
        mockSimulatePolicyForUsers.mockResolvedValue({
            data: {
                results: [{
                    user,
                    decisions: {
                        upload_file_attachment: {
                            decision: false,
                            blame: [{
                                source: POLICY_SIMULATION_BLAME_SOURCES.THIS_RULE,
                                rule_name: 'rule1',
                                expression: 'user.attributes.region == "us" && user.attributes.clearance == "il5"',
                                evaluation_tree: {
                                    kind: 'and',
                                    expression: 'user.attributes.region == "us" && user.attributes.clearance == "il5"',
                                    outcome: 'false',
                                    children: [
                                        {
                                            kind: 'compare',
                                            operator: '==',
                                            expression: 'user.attributes.region == "us"',
                                            outcome: 'true',
                                            attribute: 'user.attributes.region',
                                            actual_value: 'us',
                                            expected_value: 'us',
                                        },
                                        {
                                            kind: 'compare',
                                            operator: '==',
                                            expression: 'user.attributes.clearance == "il5"',
                                            outcome: 'false',
                                            attribute: 'user.attributes.clearance',
                                            actual_value: 'public',
                                            expected_value: 'il5',
                                        },
                                    ],
                                },
                            }],
                        },
                    },
                }],
                total: 1,
            },
        });

        renderWithContext(
            <SimulateAccessModal
                onExited={jest.fn()}
                policy={draftPolicy}
                actions={['upload_file_attachment']}
                ruleName='rule1'
                targetRole='system_user'
                targetScope='system'
            />,
        );

        await pickUser(user);

        const chipButton = await screen.findByTestId('simulate-access-row-chip-button');
        await userEvent.click(chipButton);

        // Tree starts behind the disclosure toggle — clicking it
        // mounts the rule + tree block.
        await userEvent.click(screen.getByTestId('simulate-access-details-toggle-upload_file_attachment'));

        // Tree renders inside the rule details cell — and replaces
        // the flat <code> block.
        const tree = await screen.findByTestId('simulate-access-details-tree-upload_file_attachment');
        expect(tree).toBeInTheDocument();

        // Root AND with false outcome.
        expect(within(tree).getByTestId('simulate-access-trace-node-and-false')).toBeInTheDocument();

        // Both children are walked: region leaf passes, clearance leaf fails.
        expect(within(tree).getByTestId('simulate-access-trace-node-compare-true')).toBeInTheDocument();
        expect(within(tree).getByTestId('simulate-access-trace-node-compare-false')).toBeInTheDocument();

        // Failing leaf surfaces the user's actual value as a single
        // compact "Actual: X" line. The expected literal is already
        // visible inside the expression code (== "il5"), and the
        // attribute path is too — so we don't repeat either.
        expect(within(tree).getByText(/Actual: public/i)).toBeInTheDocument();
        expect(within(tree).queryByText(/expected: il5/i)).not.toBeInTheDocument();
        expect(within(tree).queryByText(/your value:/i)).not.toBeInTheDocument();

        // Passing leaf stays quiet — the green tick + the expression
        // already convey "matched"; we don't repeat the value.
        expect(within(tree).queryByText(/Actual: us\b/i)).not.toBeInTheDocument();
    });

    it('falls back to a flat expression block when blame.evaluation_tree is absent', async () => {
        const user = TestHelper.getUserMock({id: 'uflat', username: 'flat', roles: 'system_user'});
        mockSearchProfiles.mockResolvedValue({data: [user]});
        mockSimulatePolicyForUsers.mockResolvedValue({
            data: {
                results: [{
                    user,
                    decisions: {
                        upload_file_attachment: {
                            decision: false,
                            blame: [{
                                source: POLICY_SIMULATION_BLAME_SOURCES.THIS_RULE,
                                rule_name: 'rule1',
                                expression: 'user.attributes.region == "us"',

                                // No evaluation_tree — server hasn't
                                // attached one yet (e.g. older
                                // simulator). The modal should still
                                // render the rule + flat expression.
                            }],
                        },
                    },
                }],
                total: 1,
            },
        });

        renderWithContext(
            <SimulateAccessModal
                onExited={jest.fn()}
                policy={draftPolicy}
                actions={['upload_file_attachment']}
                ruleName='rule1'
                targetRole='system_user'
                targetScope='system'
            />,
        );

        await pickUser(user);

        const chipButton = await screen.findByTestId('simulate-access-row-chip-button');
        await userEvent.click(chipButton);

        // Rule details start collapsed — expand the disclosure
        // toggle to expose the flat expression block.
        await userEvent.click(screen.getByTestId('simulate-access-details-toggle-upload_file_attachment'));

        // Rule details render with the flat expression in monospace
        // and NO tree.
        const ruleBlock = await screen.findByTestId('simulate-access-details-rule-upload_file_attachment');
        expect(ruleBlock).toHaveTextContent('user.attributes.region == "us"');
        expect(screen.queryByTestId('simulate-access-details-tree-upload_file_attachment')).not.toBeInTheDocument();
    });

    it('does not render an evaluation tree for upper-scoped blame even when one is somehow attached', async () => {
        const user = TestHelper.getUserMock({id: 'uupper', username: 'upper', roles: 'system_user'});
        mockSearchProfiles.mockResolvedValue({data: [user]});
        mockSimulatePolicyForUsers.mockResolvedValue({
            data: {
                results: [{
                    user,
                    decisions: {
                        upload_file_attachment: {
                            decision: false,
                            blame: [{
                                source: POLICY_SIMULATION_BLAME_SOURCES.SYSTEM_PERMISSION,
                                policy_id: 'p3',
                                policy_name: 'Org Wide Lockdown',
                                rule_name: 'r3',

                                // Even if a misbehaving simulator
                                // attaches a tree to upper-scoped
                                // blame, deriveTrace must skip it —
                                // upper-scoped sources never have
                                // their expression decomposed in the
                                // UI.
                                evaluation_tree: {
                                    kind: 'compare',
                                    expression: 'user.attributes.region == "blocked"',
                                    outcome: 'false',
                                },
                            }],
                        },
                    },
                }],
                total: 1,
            },
        });

        renderWithContext(
            <SimulateAccessModal
                onExited={jest.fn()}
                policy={draftPolicy}
                actions={['upload_file_attachment']}
                ruleName='rule1'
                targetRole='system_user'
                targetScope='system'
            />,
        );

        await pickUser(user);

        const chipButton = await screen.findByTestId('simulate-access-row-chip-button');
        await userEvent.click(chipButton);

        // The action row is in the modal but the rule details block
        // (and therefore the tree) must not render — pickPrimaryBlame
        // refuses to surface upper-scoped sources, and the disclosure
        // toggle is gated on a non-null trace so it's also absent.
        await screen.findByTestId('simulate-access-details-upload_file_attachment');
        expect(screen.queryByTestId('simulate-access-details-toggle-upload_file_attachment')).not.toBeInTheDocument();
        expect(screen.queryByTestId('simulate-access-details-rule-upload_file_attachment')).not.toBeInTheDocument();
        expect(screen.queryByTestId('simulate-access-details-tree-upload_file_attachment')).not.toBeInTheDocument();
    });

    it('system_permission blame keeps the chip opaque and never renders the expression in the details modal', async () => {
        const user = TestHelper.getUserMock({id: 'usys', username: 'sys', roles: 'system_user'});
        mockSearchProfiles.mockResolvedValue({data: [user]});
        mockSimulatePolicyForUsers.mockResolvedValue({
            data: {
                results: [{
                    user,
                    decisions: {
                        upload_file_attachment: {
                            decision: false,
                            blame: [{
                                source: POLICY_SIMULATION_BLAME_SOURCES.SYSTEM_PERMISSION,
                                policy_id: 'p3',
                                policy_name: 'Org Wide Lockdown',
                                rule_name: 'r3',

                                // No `expression` — the server
                                // intentionally omits it for upper-
                                // scoped sources to preserve the scope
                                // privacy boundary.
                            }],
                        },
                    },
                }],
                total: 1,
            },
        });

        renderWithContext(
            <SimulateAccessModal
                onExited={jest.fn()}
                policy={draftPolicy}
                actions={['upload_file_attachment']}
                ruleName='rule1'
                targetRole='system_user'
                targetScope='system'
            />,
        );

        await pickUser(user);

        const chip = await screen.findByTestId('simulate-access-row-chip-deny');
        expect(chip).toHaveTextContent(/system policy/i);

        // The system policy's name must NOT leak into the chip — the
        // copy stays generic for upper-scoped denies so authors can't
        // discover the contents of a policy outside the editing scope.
        expect(chip).not.toHaveTextContent(/Org Wide Lockdown/);

        // The chip is still clickable (the modal can show the chip in
        // a one-row layout) but the expression block must not render.
        const chipButton = screen.getByTestId('simulate-access-row-chip-button');
        await userEvent.click(chipButton);
        await screen.findByTestId('simulate-access-details-upload_file_attachment');
        expect(screen.queryByTestId('simulate-access-details-rule-upload_file_attachment')).not.toBeInTheDocument();
    });

    it('starts the rule details collapsed and toggles open / closed on the disclosure click', async () => {
        const user = TestHelper.getUserMock({id: 'utoggle', username: 'tog', roles: 'system_user'});
        mockSearchProfiles.mockResolvedValue({data: [user]});
        mockSimulatePolicyForUsers.mockResolvedValue({
            data: {
                results: [{
                    user,
                    decisions: {
                        upload_file_attachment: {
                            decision: false,
                            blame: [{
                                source: POLICY_SIMULATION_BLAME_SOURCES.THIS_RULE,
                                rule_name: 'rule1',
                                expression: 'user.attributes.region == "us"',
                            }],
                        },
                    },
                }],
                total: 1,
            },
        });

        renderWithContext(
            <SimulateAccessModal
                onExited={jest.fn()}
                policy={draftPolicy}
                actions={['upload_file_attachment']}
                ruleName='rule1'
                targetRole='system_user'
                targetScope='system'
            />,
        );

        await pickUser(user);

        const chipButton = await screen.findByTestId('simulate-access-row-chip-button');
        await userEvent.click(chipButton);

        // 1. Modal opens with the disclosure toggle visible but the
        //    rule block hidden — that's the "doesn't expand
        //    immediately" contract.
        const toggle = await screen.findByTestId('simulate-access-details-toggle-upload_file_attachment');
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(toggle).toHaveTextContent(/Show evaluation trace/i);
        expect(screen.queryByTestId('simulate-access-details-rule-upload_file_attachment')).not.toBeInTheDocument();

        // 2. Click → rule block mounts, toggle flips to "Hide".
        await userEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        expect(toggle).toHaveTextContent(/Hide evaluation trace/i);
        expect(screen.getByTestId('simulate-access-details-rule-upload_file_attachment')).toBeInTheDocument();

        // 3. Click again → rule block unmounts, toggle flips back to
        //    "Show". State is local to the row so closing one
        //    doesn't affect siblings (single-row test, but the
        //    component shape supports it).
        await userEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(toggle).toHaveTextContent(/Show evaluation trace/i);
        expect(screen.queryByTestId('simulate-access-details-rule-upload_file_attachment')).not.toBeInTheDocument();
    });

    // The picker pre-populates the dropdown with the first page of
    // candidates the moment "+ Add users" is clicked, before the
    // author types anything. This is the "I just want to see who's
    // available" affordance — channel-scope drafts pull channel
    // members; system-scope drafts pull general profiles.
    it('pre-populates the dropdown with channel members when targetScope is channel', async () => {
        const channelMember = TestHelper.getUserMock({id: 'cm1', username: 'member.one', roles: 'system_user'});
        mockGetProfilesInChannel.mockResolvedValue({data: [channelMember]});

        renderWithContext(
            <SimulateAccessModal
                onExited={jest.fn()}
                policy={draftPolicy}
                actions={['upload_file_attachment']}
                ruleName='rule1'
                targetRole=''
                targetScope='channel'
                channelId='channel-id-1'
            />,
        );

        // Open the picker; do NOT type anything — the pre-populate
        // path is the contract under test.
        await userEvent.click(screen.getByRole('button', {name: /Add users/i}));

        await waitFor(() => {
            expect(mockGetProfilesInChannel).toHaveBeenCalledWith('channel-id-1', 0, expect.any(Number));
        });

        // The fetched member appears in the dropdown without any
        // search input.
        await screen.findByRole('button', {name: new RegExp(channelMember.username)});

        // searchProfiles must NOT have been called: pre-populate uses
        // the cheaper "first page of channel members" path.
        expect(mockSearchProfiles).not.toHaveBeenCalled();
    });

    it('pre-populates the dropdown with general profiles when no channel context is available', async () => {
        const profile = TestHelper.getUserMock({id: 'p1', username: 'admin.user', roles: 'system_admin'});
        mockGetProfiles.mockResolvedValue({data: [profile]});

        renderWithContext(
            <SimulateAccessModal
                onExited={jest.fn()}
                policy={draftPolicy}
                actions={['upload_file_attachment']}
                ruleName='rule1'
                targetRole='system_admin'
                targetScope='system'
            />,
        );

        await userEvent.click(screen.getByRole('button', {name: /Add users/i}));

        await waitFor(() => {
            expect(mockGetProfiles).toHaveBeenCalled();
        });

        await screen.findByRole('button', {name: new RegExp(profile.username)});
        expect(mockSearchProfiles).not.toHaveBeenCalled();
    });
});
