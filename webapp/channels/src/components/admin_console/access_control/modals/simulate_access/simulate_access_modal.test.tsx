// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {AccessControlPolicy} from '@mattermost/types/access_control';
import {POLICY_SIMULATION_BLAME_SOURCES} from '@mattermost/types/access_control';
import type {UserPropertyField} from '@mattermost/types/properties_user';
import {SESSION_ATTRIBUTES_GROUP_ID} from '@mattermost/types/properties_user';

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

    // Match real thunks (async functions) so redux-thunk always invokes these.
    searchProfiles: (term: string, opts: any) => async () => mockSearchProfiles(term, opts),
    getProfilesInChannel: (channelId: string, page: number, perPage: number) => async () =>
        mockGetProfilesInChannel(channelId, page, perPage),
    getProfiles: (page: number, perPage: number, opts: any) => async () => mockGetProfiles(page, perPage, opts),
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

    it('renders the inline search bar and the scope toggle defaulting to "All policies"', async () => {
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

        // Search bar is always visible (replaces the previous "+ Add users"
        // popover trigger). The scope toggle defaults to "All policies".
        expect(screen.getByTestId('simulate-access-search')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /Add users/i})).not.toBeInTheDocument();
        expect(screen.getByTestId('simulate-access-scope-all')).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByTestId('simulate-access-scope-this-rule')).toHaveAttribute('aria-pressed', 'false');

        // Permission filter only renders for multi-action rules. With
        // a single action there's nothing to filter, so the dropdown
        // is intentionally hidden.
        expect(screen.queryByTestId('simulate-access-permission-filter')).not.toBeInTheDocument();
    });

    it('does not call simulator when the initial user fetch returns no candidates', async () => {
        // Default mocks return empty user lists, so the initial fetch
        // resolves with no rows and the auto-run effect short-circuits.
        // The footer no longer carries a Re-run button (auto-rerun on
        // every search/page/scope/override change makes it redundant)
        // and a manual Close button (the modal X handles dismissal).
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

        // Allow the initial fetch + debounced effect to settle.
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
        });
        expect(mockSimulatePolicyForUsers).not.toHaveBeenCalled();

        // Footer hosts only the summary line (and the paginator when
        // there are multiple pages). The Re-run text button is gone
        // — auto-rerun handles every relevant state change. The
        // modal's standard X close in the top-right corner remains
        // (aria-label=\"Close\") and serves as the only dismiss
        // affordance.
        expect(screen.queryByRole('button', {name: /Re-run/i})).not.toBeInTheDocument();
    });

    // The picker is now data-driven: the modal pre-populates page 0
    // on mount via getProfiles/getProfilesInChannel; the inline search
    // input drives `searchProfiles` for typed queries. To stage a user
    // for assertion we type the username into the search bar and wait
    // for the row to mount in the table — no popover or click on a
    // result item is required.
    async function pickUser(user: any) {
        const searchInput = await screen.findByTestId('simulate-access-search') as HTMLInputElement;

        // Allow the initial page-0 fetch (getProfiles / getProfilesInChannel)
        // to settle before the search dispatch lands so the assertion
        // races aren't fighting two pending promises.
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 50));
        });

        fireEvent.change(searchInput, {target: {value: user.username}});

        // Wait for the search debounce + dispatched search to land,
        // then for the row to mount with the auto-run simulator
        // having dispatched.
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 350));
        });

        await screen.findByText(new RegExp(`@${user.username}`), undefined, {timeout: 3000});
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

        // Permission filter is rendered (multi-action rule). Default
        // label is "All permissions" → mixed aggregate chip.
        const filterButton = await screen.findByTestId('simulate-access-permission-filter');
        expect(filterButton).toHaveTextContent(/All permissions/);
        await screen.findByText(/Mixed/i);

        // Select "Download files" → only the allowed verdict is
        // shown; the row chip flips to allow and the filter label
        // updates to reflect the active narrowing.
        await userEvent.click(filterButton);
        await userEvent.click(await screen.findByRole('menuitemradio', {name: /Download files/i}));
        await screen.findByTestId('simulate-access-row-chip-allow');
        expect(screen.queryByText(/Mixed/i)).not.toBeInTheDocument();
        expect(filterButton).toHaveTextContent(/Download files/);

        // Switch to "Upload files" → row collapses to deny, label
        // flips to the upload action.
        await userEvent.click(filterButton);
        await userEvent.click(await screen.findByRole('menuitemradio', {name: /Upload files/i}));
        await screen.findByTestId('simulate-access-row-chip-deny');
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

        // The single configured field renders as a dropdown because
        // it's type=select with options. Setting it + Apply writes
        // into the user's session_overrides; the auto-rerun effect
        // (triggered by the rows' session-overrides change) re-fires
        // the simulator without an explicit Re-run click.
        const select = editor.querySelector('select') as HTMLSelectElement;
        expect(select).toBeInTheDocument();
        fireEvent.change(select, {target: {value: 'WiFi'}});
        await userEvent.click(screen.getByRole('button', {name: /Apply/i}));

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

        // Wait for the row to render — the username is the cheapest
        // observable that confirms the picker row mounted (the picker
        // dropped the remove-user button when the modal moved to a
        // data-driven user list).
        await screen.findByText(`@${user.username}`);
        expect(screen.queryByTestId(`simulate-access-row-edit-${user.id}`)).not.toBeInTheDocument();

        // The "Recent activity" column header must not appear.
        expect(screen.queryByRole('columnheader', {name: /Recent activity/i})).not.toBeInTheDocument();
    });

    it('renders a 2-column table when no session-attribute fields are configured so Result hugs the right edge', async () => {
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

        // 2 column headers (User / Result) — Recent activity and
        // Actions are both dropped when no session-attribute fields
        // are configured. Earlier the empty Actions column padded
        // Result away from the right edge of the table; with the
        // column gone Result snaps to the trailing edge as intended.
        await waitFor(() => {
            expect(screen.getAllByRole('columnheader')).toHaveLength(2);
        });

        // The data row should likewise have exactly 2 cells: user
        // identity and the result chip. The chip's <td> is the last
        // cell in the row, so the chip and its column header sit at
        // the table's right edge with no empty trailing column.
        const rowCells = screen.getAllByRole('row')[1].querySelectorAll('td');
        expect(rowCells).toHaveLength(2);

        const denyChip = await screen.findByTestId('simulate-access-row-chip-deny');
        const denyCell = denyChip.closest('td');
        expect(denyCell).not.toBeNull();
        expect(denyCell?.classList.contains('SimulateAccessModal__rowResult')).toBe(true);
        expect(denyCell?.nextElementSibling).toBeNull();
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

    // sibling_saved scenario: the editing rule alone would have
    // denied (e.g. an AND that fails) but a sibling rule on the same
    // role + action OR-merged at compile time and allowed, so the
    // overall verdict is allow. The trace used to show only the
    // editing rule's failing tree without ever telling the author
    // which sibling actually saved the verdict — extending
    // merged_rules to sibling_saved blame fixes that by rendering
    // per-rule sections, where the sibling that allowed shows a
    // green-leaf tree alongside the editing rule's red-leaf one.
    it('sibling_saved blame renders per-rule sections so the saving sibling rule is visible', async () => {
        const user = TestHelper.getUserMock({id: 'usaved', username: 'saved', roles: 'system_user'});
        mockSearchProfiles.mockResolvedValue({data: [user]});

        const savedDraft: AccessControlPolicy = {
            id: 'p1',
            name: 'p1',
            type: 'channel',
            rules: [
                {
                    name: 'Strict',
                    role: 'channel_user',
                    actions: ['upload_file_attachment'],
                    expression: '"Orion" in user.attributes.Program && "Artemis" in user.attributes.Program',
                },
                {
                    name: 'Members',
                    role: 'channel_user',
                    actions: ['upload_file_attachment'],
                    expression: '"Helios" in user.attributes.Program',
                },
            ],
        };

        mockSimulatePolicyForUsers.mockResolvedValue({
            data: {
                results: [{
                    user,
                    decisions: {
                        upload_file_attachment: {

                            // Overall decision is ALLOW: a sibling
                            // rule allowed even though the editing
                            // rule alone denied.
                            decision: true,
                            blame: [{
                                source: POLICY_SIMULATION_BLAME_SOURCES.SIBLING_SAVED,
                                rule_name: 'Strict',
                                role: 'channel_user',
                                expression: '"Orion" in user.attributes.Program && "Artemis" in user.attributes.Program',
                                merged_rules: [
                                    {
                                        name: 'Strict',
                                        expression: '"Orion" in user.attributes.Program && "Artemis" in user.attributes.Program',
                                        evaluation_tree: {
                                            kind: 'and',
                                            expression: '"Orion" in user.attributes.Program && "Artemis" in user.attributes.Program',
                                            outcome: 'false',
                                            children: [
                                                {
                                                    kind: 'compare',
                                                    operator: 'in',
                                                    expression: '"Orion" in user.attributes.Program',
                                                    outcome: 'false',
                                                    attribute: 'user.attributes.Program',
                                                    actual_value: '["Helios"]',
                                                    expected_value: 'Orion',
                                                },
                                                {
                                                    kind: 'compare',
                                                    operator: 'in',
                                                    expression: '"Artemis" in user.attributes.Program',
                                                    outcome: 'false',
                                                    attribute: 'user.attributes.Program',
                                                    actual_value: '["Helios"]',
                                                    expected_value: 'Artemis',
                                                },
                                            ],
                                        },
                                    },
                                    {
                                        name: 'Members',
                                        expression: '"Helios" in user.attributes.Program',
                                        evaluation_tree: {
                                            kind: 'compare',
                                            operator: 'in',
                                            expression: '"Helios" in user.attributes.Program',
                                            outcome: 'true',
                                            attribute: 'user.attributes.Program',
                                            actual_value: '["Helios"]',
                                            expected_value: 'Helios',
                                        },
                                    },
                                ],
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
                policy={savedDraft}
                actions={['upload_file_attachment']}
                ruleName='Strict'
                targetRole=''
                targetScope='system'
            />,
        );

        await pickUser(user);

        // The row chip uses the SIBLING_SAVED source so the wording
        // surfaces the "another rule" save — that's how the user
        // knows the editing rule didn't carry the verdict on its own.
        const allowChip = await screen.findByTestId('simulate-access-row-chip-allow-saved');
        expect(allowChip).toHaveTextContent(/another rule/i);

        const chipButton = screen.getByTestId('simulate-access-row-chip-button');
        await userEvent.click(chipButton);
        await userEvent.click(screen.getByTestId('simulate-access-details-toggle-upload_file_attachment'));

        // Per-rule sections render: the editing rule's failing tree
        // sits alongside the sibling that actually allowed — without
        // this fix the author saw only the editing rule's failing
        // tree and couldn't tell which sibling carried the verdict.
        const ruleOne = await screen.findByTestId('simulate-access-details-merged-rule-upload_file_attachment-1');
        expect(ruleOne).toHaveTextContent(/Rule: Strict/);
        expect(ruleOne).toHaveTextContent(/Actual: \["Helios"\]/);

        const ruleTwo = screen.getByTestId('simulate-access-details-merged-rule-upload_file_attachment-2');
        expect(ruleTwo).toHaveTextContent(/Rule: Members/);
        expect(ruleTwo).toHaveTextContent('"Helios" in user.attributes.Program');
    });

    // "This rule only" view of the sibling_saved scenario: the
    // server's filterResponseToEditingRuleScope post-process appends
    // a no_applicable_rule marker so the chip can render "this rule
    // doesn't apply" instead of the misleading "Allowed · another
    // rule" — at this scope the sibling that saved the verdict is
    // out of scope, so the author needs to see that THIS rule didn't
    // contribute, not that some unnamed other rule did. The
    // sibling_saved entry stays on the blame so the details modal
    // can still render the trace.
    it('no_applicable_rule blame renders the "this rule doesn\'t apply" chip in this-rule-only mode', async () => {
        const user = TestHelper.getUserMock({id: 'unar', username: 'narrow', roles: 'system_user'});
        mockSearchProfiles.mockResolvedValue({data: [user]});

        const draft: AccessControlPolicy = {
            id: 'p1',
            name: 'p1',
            type: 'channel',
            rules: [{
                name: 'Strict',
                role: 'channel_user',
                actions: ['upload_file_attachment'],
                expression: '"Orion" in user.attributes.Program',
            }],
        };

        mockSimulatePolicyForUsers.mockResolvedValue({
            data: {
                results: [{
                    user,
                    decisions: {
                        upload_file_attachment: {
                            decision: true,
                            blame: [

                                // What the server returns for the
                                // "this rule only" view: sibling_saved
                                // stays for trace rendering, and the
                                // post-process appends the
                                // no_applicable_rule marker so the
                                // chip can pick it up over the
                                // sibling_saved label.
                                {
                                    source: POLICY_SIMULATION_BLAME_SOURCES.SIBLING_SAVED,
                                    rule_name: 'Strict',
                                    role: 'channel_user',
                                    expression: '"Orion" in user.attributes.Program',
                                },
                                {
                                    source: POLICY_SIMULATION_BLAME_SOURCES.NO_APPLICABLE_RULE,
                                },
                            ],
                        },
                    },
                }],
                total: 1,
            },
        });

        renderWithContext(
            <SimulateAccessModal
                onExited={jest.fn()}
                policy={draft}
                actions={['upload_file_attachment']}
                ruleName='Strict'
                targetRole=''
                targetScope='system'
            />,
        );

        await pickUser(user);

        // The chip must read "this rule doesn't apply" and pick the
        // dedicated test id — NOT the allow-saved chip and NOT the
        // plain allow chip.
        const chip = await screen.findByTestId('simulate-access-row-chip-not-applicable-rule');
        expect(chip).toHaveTextContent(/this rule doesn't apply/i);
        expect(screen.queryByTestId('simulate-access-row-chip-allow-saved')).not.toBeInTheDocument();
        expect(screen.queryByTestId('simulate-access-row-chip-allow')).not.toBeInTheDocument();
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

    // System-console scenario: the simulator emits an informational
    // allow blame for the editing draft when a peer policy is the
    // actual denier. The picker renders both as numbered sections so
    // authors can see "my policy allowed; the peer policy denied" at
    // a glance — this fixes the prior UX gap where the editing draft
    // disappeared entirely from the trace whenever it allowed.
    it('renders an informational "your policy allowed" section alongside the peer denier', async () => {
        const user = TestHelper.getUserMock({id: 'umixed', username: 'mix', roles: 'system_user'});
        mockSearchProfiles.mockResolvedValue({data: [user]});
        mockSimulatePolicyForUsers.mockResolvedValue({
            data: {
                results: [{
                    user,
                    decisions: {
                        upload_file_attachment: {
                            decision: false,

                            // Mixed-outcome blame array: a peer policy
                            // denied, AND the editing draft itself
                            // allowed — the simulator emits the latter
                            // as an Outcome=allow informational entry
                            // so the picker can show "your policy
                            // allowed" alongside the peer denier.
                            blame: [
                                {
                                    source: POLICY_SIMULATION_BLAME_SOURCES.PEER_POLICY,
                                    outcome: 'deny',
                                    policy_id: 'p9',
                                    policy_name: 'Members back up',
                                    rule_name: 'r9',
                                    role: 'system_user',
                                    expression: '"Helios" in user.attributes.Program && "Artemis" in user.attributes.Program',
                                },
                                {
                                    source: POLICY_SIMULATION_BLAME_SOURCES.THIS_RULE,
                                    outcome: 'allow',
                                    policy_id: 'p1',
                                    rule_name: 'rule1',
                                    role: 'system_user',
                                    expression: '"Helios" in user.attributes.Program || "Orion" in user.attributes.Program',
                                },
                            ],
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

        // Row-level chip names the actual denier. Informational allow
        // entries must not influence the chip's primary-deny pick or
        // the row would confusingly say "your policy" for a
        // peer-policy deny.
        const rowChip = await screen.findByTestId('simulate-access-row-chip-deny');
        expect(rowChip).toHaveTextContent(/Members back up/);
        expect(rowChip).not.toHaveTextContent(/your policy/i);

        const chipButton = await screen.findByTestId('simulate-access-row-chip-button');
        await userEvent.click(chipButton);
        await userEvent.click(screen.getByTestId('simulate-access-details-toggle-upload_file_attachment'));

        // Mixed explainer text spells out the deny-wins semantics so
        // authors don't read "1 policy denied, 1 allowed → why is it
        // an overall deny?" as a bug.
        const policiesContainer = await screen.findByTestId('simulate-access-details-policies-upload_file_attachment');
        expect(policiesContainer).toHaveTextContent(/1 policy denied/i);
        expect(policiesContainer).toHaveTextContent(/1 policy allowed/i);
        expect(policiesContainer).toHaveTextContent(/deny-wins/i);

        // Two numbered sections: editing draft first (allow outcome,
        // higher priority in SAME_SCOPE_SOURCE_PRIORITY) and peer
        // denier second (deny outcome). The editing draft's chip uses
        // the "Your policy" wording so the author can tell their own
        // contribution apart from peer policies.
        const policyOne = within(policiesContainer).getByTestId('simulate-access-details-policy-upload_file_attachment-1');
        expect(policyOne).toHaveTextContent(/Your policy: Allowed/i);

        const policyTwo = within(policiesContainer).getByTestId('simulate-access-details-policy-upload_file_attachment-2');
        expect(policyTwo).toHaveTextContent(/Members back up/);
        expect(policyTwo).toHaveTextContent(/Denied/);
    });

    // System-console scenario: a deny can pin on the editing draft AND
    // one or more peer (or same-scope system) policies at once. The
    // modal renders one numbered policy section per contributor, in
    // priority order (this_rule first, peer_policy after), so the
    // author can see exactly which policies caused the deny — the
    // single-trace view used to drop everything but the highest-
    // priority blame. Upper-scoped blame entries are filtered upstream
    // by the public-server's privacy classification, so they never
    // make it into this list.
    it('renders one numbered policy section per same-scope contributor when multiple policies deny', async () => {
        const user = TestHelper.getUserMock({id: 'umulti', username: 'multi', roles: 'system_user'});
        mockSearchProfiles.mockResolvedValue({data: [user]});
        mockSimulatePolicyForUsers.mockResolvedValue({
            data: {
                results: [{
                    user,
                    decisions: {
                        upload_file_attachment: {
                            decision: false,

                            // Two same-scope blames: the editing draft
                            // (this_rule) and a peer system policy. Both
                            // ship merged_rules with per-rule eval trees
                            // so the renderer should expand each policy
                            // into a numbered section with its own tree.
                            blame: [
                                {
                                    source: POLICY_SIMULATION_BLAME_SOURCES.THIS_RULE,
                                    policy_id: 'p1',
                                    rule_name: 'rule1',
                                    role: 'system_user',
                                    expression: 'user.attributes.region == "us"',
                                },
                                {
                                    source: POLICY_SIMULATION_BLAME_SOURCES.PEER_POLICY,
                                    policy_id: 'p9',
                                    policy_name: 'IL5 Block',
                                    rule_name: 'r9a',
                                    role: 'system_user',
                                    expression: 'user.attributes.clearance == "il5"',
                                },
                            ],
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
        await userEvent.click(screen.getByTestId('simulate-access-details-toggle-upload_file_attachment'));

        // Numbered policy sections render in priority order: the
        // editing draft (this_rule) takes slot 1, the peer policy
        // takes slot 2.
        const policiesContainer = await screen.findByTestId('simulate-access-details-policies-upload_file_attachment');
        expect(policiesContainer).toBeInTheDocument();

        const policyOne = within(policiesContainer).getByTestId('simulate-access-details-policy-upload_file_attachment-1');
        const policyTwo = within(policiesContainer).getByTestId('simulate-access-details-policy-upload_file_attachment-2');

        // The editing draft renders without a Policy: line (the user
        // IS the policy) but still carries its own rule name.
        expect(policyOne).toHaveTextContent(/Rule: rule1/);
        expect(policyOne).not.toHaveTextContent(/Policy: IL5 Block/);

        // The peer policy section names the contributing policy.
        expect(policyTwo).toHaveTextContent(/Policy: IL5 Block/);
        expect(policyTwo).toHaveTextContent(/r9a/);

        // The single-trace tree element is NOT rendered when
        // multi-policy mode kicks in: each policy section nests its
        // own tree element instead.
        expect(
            screen.queryByTestId('simulate-access-details-tree-upload_file_attachment'),
        ).not.toBeInTheDocument();
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

    // The simulator OR-folds every draft rule sharing the same
    // (role, action) into a single program (engine.JoinExpressions) and
    // attaches a single evaluation_tree on the merged expression. The
    // trace header used to read "Rule: <X>" — which was misleading
    // because the tree below is the merged combination of every rule
    // for that role + action, not just <X>. The header now switches to
    // a "Combined evaluation for role <role>" affordance whenever the
    // draft policy has more than one rule contributing.
    it('renders a combined-evaluation header listing every contributing draft rule when multiple rules share the same role + action', async () => {
        const user = TestHelper.getUserMock({id: 'umerge', username: 'merge', roles: 'system_user'});
        mockSearchProfiles.mockResolvedValue({data: [user]});

        // Draft policy with two rules sharing role=channel_user + the
        // same action: that's the merge case the new header is designed
        // to surface honestly.
        const mergedDraft: AccessControlPolicy = {
            id: 'pmerge',
            name: 'pmerge',
            type: 'channel',
            rules: [
                {
                    name: 'Security officer',
                    role: 'channel_user',
                    actions: ['upload_file_attachment'],
                    expression: 'user.attributes.Department == "Information Governance"',
                },
                {
                    name: 'Engineers',
                    role: 'channel_user',
                    actions: ['upload_file_attachment'],
                    expression: '"Orion" in user.attributes.Program',
                },
            ],
        };

        mockSimulatePolicyForUsers.mockResolvedValue({
            data: {
                results: [{
                    user,
                    decisions: {
                        upload_file_attachment: {
                            decision: false,
                            blame: [{
                                source: POLICY_SIMULATION_BLAME_SOURCES.THIS_RULE,
                                rule_name: 'Security officer',
                                role: 'channel_user',
                                expression: '(user.attributes.Department == "Information Governance") || ("Orion" in user.attributes.Program)',

                                // Server-provided per-rule breakdown:
                                // each entry maps 1:1 to a contributing
                                // draft rule (in JoinExpressions order)
                                // and carries that rule's standalone
                                // evaluation tree.
                                merged_rules: [
                                    {
                                        name: 'Security officer',
                                        expression: 'user.attributes.Department == "Information Governance"',
                                        evaluation_tree: {
                                            kind: 'compare',
                                            operator: '==',
                                            expression: 'user.attributes.Department == "Information Governance"',
                                            outcome: 'false',
                                            attribute: 'user.attributes.Department',
                                            actual_value: 'Engineering',
                                            expected_value: 'Information Governance',
                                        },
                                    },
                                    {
                                        name: 'Engineers',
                                        expression: '"Orion" in user.attributes.Program',
                                        evaluation_tree: {
                                            kind: 'compare',
                                            operator: 'in',
                                            expression: '"Orion" in user.attributes.Program',
                                            outcome: 'false',
                                            attribute: 'user.attributes.Program',
                                            actual_value: '["Helios"]',
                                            expected_value: 'Orion',
                                        },
                                    },
                                ],
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
                policy={mergedDraft}
                actions={['upload_file_attachment']}
                ruleName='Security officer'

                // Empty targetRole bypasses the picker's role-applicability
                // filter; the role on the BLAME entry (channel_user) is
                // what drives the merged-rule lookup we're asserting on.
                targetRole=''
                targetScope='system'
            />,
        );

        await pickUser(user);

        const chipButton = await screen.findByTestId('simulate-access-row-chip-button');
        await userEvent.click(chipButton);

        // Expand the disclosure so the header + trace mount.
        await userEvent.click(screen.getByTestId('simulate-access-details-toggle-upload_file_attachment'));

        // Combined-evaluation header replaces the misleading "Rule: X"
        // line because the draft policy has more than one rule for
        // (channel_user, upload_file_attachment).
        const header = await screen.findByTestId('simulate-access-details-origin-upload_file_attachment');
        expect(header).toHaveTextContent(/Combined evaluation for role channel_user/i);

        // The single editing-rule label MUST NOT render in this case
        // — that wording is what the user flagged as misleading.
        expect(header).not.toHaveTextContent(/^Rule: Security officer/);

        // The help-icon button is wired up so authors can see which
        // rules merged into the trace below.
        expect(
            screen.getByTestId('simulate-access-details-origin-help-upload_file_attachment'),
        ).toBeInTheDocument();

        // Numbered per-rule sections replace the single merged tree
        // when the server attached per-rule evaluation trees: each
        // section is keyed by index (1, 2, ...) so the badge in the
        // UI maps to the same position in the help-icon tooltip's
        // ordered list above.
        const mergedContainer = await screen.findByTestId('simulate-access-details-merged-upload_file_attachment');
        expect(mergedContainer).toBeInTheDocument();

        const ruleOne = within(mergedContainer).getByTestId('simulate-access-details-merged-rule-upload_file_attachment-1');
        const ruleTwo = within(mergedContainer).getByTestId('simulate-access-details-merged-rule-upload_file_attachment-2');
        expect(ruleOne).toHaveTextContent(/Rule: Security officer/);
        expect(ruleTwo).toHaveTextContent(/Rule: Engineers/);

        // The single merged tree is intentionally NOT rendered in
        // this branch — per-rule sections supersede it.
        expect(
            screen.queryByTestId('simulate-access-details-tree-upload_file_attachment'),
        ).not.toBeInTheDocument();
    });

    // Single-rule policies (the common case) keep the original
    // "Rule: <name>" wording — there is no merging happening so the
    // simpler label is accurate and less verbose than the combined
    // header.
    it('keeps the simple "Rule: <name>" header when only one draft rule contributes', async () => {
        const user = TestHelper.getUserMock({id: 'usingle', username: 'single', roles: 'system_user'});
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
                                role: 'channel_user',
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
                targetRole=''
                targetScope='system'
            />,
        );

        await pickUser(user);

        const chipButton = await screen.findByTestId('simulate-access-row-chip-button');
        await userEvent.click(chipButton);
        await userEvent.click(screen.getByTestId('simulate-access-details-toggle-upload_file_attachment'));

        const ruleBlock = await screen.findByTestId('simulate-access-details-rule-upload_file_attachment');
        expect(ruleBlock).toHaveTextContent(/Rule: rule1/);

        // Combined-evaluation affordance is NOT shown when no merging
        // is happening: a single rule only would make the help icon
        // redundant and visually noisy.
        expect(
            screen.queryByTestId('simulate-access-details-origin-upload_file_attachment'),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByTestId('simulate-access-details-origin-help-upload_file_attachment'),
        ).not.toBeInTheDocument();
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

    // The modal pre-populates page 0 on mount via getProfilesInChannel
    // (channel scope) or getProfiles (system / no-channel scope) and
    // auto-runs the simulator against those rows. Authors no longer
    // have to click "+ Add users" to see anything — the data shows up
    // immediately.
    it('pre-populates the table with channel members when targetScope is channel', async () => {
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

        await waitFor(
            () => {
                // Asserts both that we hit the channel-members endpoint
                // AND that we requested an over-fetch (PAGE_SIZE + 1)
                // so the modal can decide whether to expose the Next
                // page button without a separate count call.
                expect(mockGetProfilesInChannel).toHaveBeenCalledWith('channel-id-1', 0, expect.any(Number));
            },
            {timeout: 5000},
        );

        // The fetched member appears in the table directly.
        await screen.findByText(`@${channelMember.username}`, undefined, {timeout: 5000});

        // searchProfiles must NOT have been called: the initial render
        // bypasses the typed-search path entirely.
        expect(mockSearchProfiles).not.toHaveBeenCalled();
    });

    it('pre-populates the table with general profiles when no channel context is available', async () => {
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

        await waitFor(
            () => {
                expect(mockGetProfiles).toHaveBeenCalled();
            },
            {timeout: 5000},
        );

        await screen.findByText(`@${profile.username}`, undefined, {timeout: 5000});
        expect(mockSearchProfiles).not.toHaveBeenCalled();
    });

    // Pagination: when the initial fetch returns more than PAGE_SIZE
    // rows (we over-fetch by one to detect this without a count
    // round-trip), the modal exposes a Next button. Clicking it
    // refetches the next page; the previous button stays disabled on
    // page 0 and becomes available once we navigate forward.
    it('exposes a Next button when the first page over-fetches and refetches on click', async () => {
        // PAGE_SIZE is 10 in the modal. Building 11 mocked profiles
        // makes the over-fetch reveal the "next page exists" hint.
        const pageOne = Array.from({length: 11}, (_, i) =>
            TestHelper.getUserMock({id: `p1-${i}`, username: `pageone${i}`, roles: 'system_user'}),
        );
        const pageTwo = [
            TestHelper.getUserMock({id: 'p2-0', username: 'pagetwo0', roles: 'system_user'}),
        ];

        mockGetProfiles.mockImplementation((page: number) => {
            if (page === 0) {
                return Promise.resolve({data: pageOne});
            }
            return Promise.resolve({data: pageTwo});
        });

        renderWithContext(
            <SimulateAccessModal
                onExited={jest.fn()}
                policy={draftPolicy}
                actions={['upload_file_attachment']}
                ruleName='rule1'
                targetRole=''
                targetScope='system'
            />,
        );

        // Page 0 mounts with 10 visible rows (the over-fetch row is
        // sliced off the visible list and only used to set the Next
        // button enabled state).
        await screen.findByText('@pageone0', undefined, {timeout: 5000});

        // Paginator lives in the modal footer; Prev disabled on page
        // 0, Next enabled because the over-fetch detected more rows.
        const paginator = await screen.findByTestId('simulate-access-pagination');
        const prev = within(paginator).getByTestId('simulate-access-pagination-prev');
        const next = within(paginator).getByTestId('simulate-access-pagination-next');
        expect(prev).toBeDisabled();
        expect(next).toBeEnabled();

        // Click Next → page 1 fetched, the page-2 user replaces
        // page-1 rows, and `prev` is now enabled.
        await userEvent.click(next);
        await waitFor(() => {
            expect(mockGetProfiles).toHaveBeenCalledWith(1, expect.any(Number), expect.anything());
        });
        await screen.findByText('@pagetwo0', undefined, {timeout: 5000});
        expect(within(paginator).getByTestId('simulate-access-pagination-prev')).toBeEnabled();
    });

    // Typed search bypasses pagination — Mattermost's search API
    // returns top-N matches and isn't cursor-paginated, so showing the
    // paginator would lie about the available navigation. The modal
    // hides the paginator while a search term is active and refetches
    // via searchProfiles instead.
    it('hides the paginator while a search term is active and uses searchProfiles', async () => {
        const matched = TestHelper.getUserMock({id: 'sm1', username: 'searched', roles: 'system_user'});

        // Initial fetch has more than one page so the paginator would
        // otherwise be visible — that lets us assert it disappears
        // when the search term lands. PAGE_SIZE=10, so we need >10
        // users in the over-fetch window to reveal the paginator.
        const initial = Array.from({length: 11}, (_, i) =>
            TestHelper.getUserMock({id: `init${i}`, username: `init${i}`, roles: 'system_user'}),
        );
        mockGetProfiles.mockResolvedValue({data: initial});
        mockSearchProfiles.mockResolvedValue({data: [matched]});

        renderWithContext(
            <SimulateAccessModal
                onExited={jest.fn()}
                policy={draftPolicy}
                actions={['upload_file_attachment']}
                ruleName='rule1'
                targetRole=''
                targetScope='system'
            />,
        );

        // Wait for the paginator to mount on the un-searched view.
        await screen.findByTestId('simulate-access-pagination');

        // Type a search term → debounced refetch via searchProfiles.
        const searchInput = await screen.findByTestId('simulate-access-search') as HTMLInputElement;
        fireEvent.change(searchInput, {target: {value: 'searched'}});
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 350));
        });

        await screen.findByText('@searched', undefined, {timeout: 5000});

        // Paginator is hidden during search.
        expect(screen.queryByTestId('simulate-access-pagination')).not.toBeInTheDocument();
        expect(mockSearchProfiles).toHaveBeenCalledWith('searched', expect.objectContaining({limit: expect.any(Number)}));
    });
});
