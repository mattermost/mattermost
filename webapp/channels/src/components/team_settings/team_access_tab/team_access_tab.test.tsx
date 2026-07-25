// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import {Permissions} from 'mattermost-redux/constants';

import {act, renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import AccessTab from './team_access_tab';

describe('components/TeamSettings', () => {
    const patchTeam = jest.fn().mockReturnValue({data: true});
    const regenerateTeamInviteId = jest.fn().mockReturnValue({data: true});
    const getTeamStats = jest.fn().mockResolvedValue({data: {total_member_count: 10, active_member_count: 10}});
    const getTeamAccessControlPolicy = jest.fn().mockResolvedValue({data: {policy: null, enforced: false}});
    const getAccessControlPolicy = jest.fn().mockResolvedValue({data: undefined});
    const searchUsersForExpression = jest.fn().mockResolvedValue({data: {users: [], total: 0}});
    const createAccessControlTeamSyncJob = jest.fn().mockResolvedValue({data: {}});
    const baseActions = {
        patchTeam,
        regenerateTeamInviteId,
        getTeamStats,
        getTeamAccessControlPolicy,
        getAccessControlPolicy,
        searchUsersForExpression,
        createAccessControlTeamSyncJob,
    };
    const defaultProps: ComponentProps<typeof AccessTab> = {
        team: TestHelper.getTeamMock({id: 'team_id'}),
        actions: baseActions,
        teamMembershipAccessControlEnabled: false,
        areThereUnsavedChanges: true,
        showTabSwitchError: false,
        setAreThereUnsavedChanges: jest.fn(),
        setShowTabSwitchError: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should not render team invite section if no permissions for team inviting', () => {
        const props = {...defaultProps, canInviteTeamMembers: false};
        renderWithContext(<AccessTab {...props}/>);
        const inviteContainer = screen.queryByTestId('teamInviteContainer');
        expect(inviteContainer).toBeNull();
    });

    test('should call regenerateTeamInviteId on handleRegenerateInviteId', () => {
        const state = {
            entities: {
                roles: {
                    roles: {
                        team_admin: {
                            name: 'team_admin',
                            permissions: [Permissions.INVITE_USER],
                        },
                    },
                },
                users: {
                    profiles: {
                        test_user: TestHelper.getUserMock({id: 'test_user', roles: 'team_admin'}),
                    },
                    currentUserId: 'test_user',
                },
                teams: {
                    currentTeamId: 'team_id',
                    teams: {
                        team_id: {...defaultProps.team},
                    },
                },
            },
        };
        const wrapper = renderWithContext(<AccessTab {...defaultProps}/>, state);
        wrapper.getByTestId('regenerateButton').click();
        expect(baseActions.regenerateTeamInviteId).toHaveBeenCalledTimes(1);
        expect(baseActions.regenerateTeamInviteId).toHaveBeenCalledWith(defaultProps.team?.id);
    });

    test('should not render allowed domains checkbox if no permissions for team inviting', () => {
        const props = {...defaultProps, canInviteTeamMembers: false};
        renderWithContext(<AccessTab {...props}/>);
        const allowedDomainsCheckbox = screen.queryByTestId('allowedDomainsCheckbox');
        expect(allowedDomainsCheckbox).toBeNull();
    });

    test('should not show allowed domains input if allowed domains is empty', () => {
        const props = {...defaultProps, team: TestHelper.getTeamMock({allowed_domains: ''})};
        renderWithContext(<AccessTab {...props}/>);
        const allowedDomainsInput = screen.queryByText('Seperate multiple domains with a space, comma, tab or enter.');
        expect(allowedDomainsInput).toBeNull();
    });

    test('should show allowed domains input if allowed domains is not empty', () => {
        const props = {...defaultProps, team: TestHelper.getTeamMock({allowed_domains: 'test.com'})};
        renderWithContext(<AccessTab {...props}/>);
        const allowedDomainsInput = screen.getByText('Seperate multiple domains with a space, comma, tab or enter.');
        expect(allowedDomainsInput).toBeInTheDocument();
        const allowedDomainsInputValue = screen.getByText('test.com');
        expect(allowedDomainsInputValue).toBeInTheDocument();
    });

    test('should call patchTeam on handleAllowedDomainsSubmit', async () => {
        const props = {...defaultProps, team: TestHelper.getTeamMock({allowed_domains: 'test.com'})};
        renderWithContext(<AccessTab {...props}/>);
        const allowedDomainsInput = screen.getAllByRole('combobox')[0];
        const newDomain = 'best.com';
        await act(async () => {
            await allowedDomainsInput.focus();
            await userEvent.type(allowedDomainsInput, `${newDomain},`);
        });

        const newDomainText = screen.getByText(newDomain);
        expect(newDomainText).toBeInTheDocument();

        const saveButton = screen.getByTestId('SaveChangesPanel__save-btn');
        await userEvent.click(saveButton);
        expect(baseActions.patchTeam).toHaveBeenCalledTimes(1);
        expect(baseActions.patchTeam).toHaveBeenCalledWith({
            allowed_domains: 'test.com, best.com',
            id: defaultProps.team?.id,
        });
    });

    test('should render Public Team and Private Team discoverability cards', () => {
        renderWithContext(<AccessTab {...defaultProps}/>);
        expect(screen.getByText('Public Team')).toBeInTheDocument();
        expect(screen.getByText('Private Team')).toBeInTheDocument();
    });

    test('should mark save panel dirty when discoverability card is clicked', async () => {
        const props = {
            ...defaultProps,
            team: TestHelper.getTeamMock({id: 'team_id', type: 'O', allow_open_invite: true}),
        };
        renderWithContext(<AccessTab {...props}/>);
        await userEvent.click(screen.getByText('Private Team'));
        expect(defaultProps.setAreThereUnsavedChanges).toHaveBeenCalledWith(true);
    });

    test('non-ABAC team: selecting Private patches allow_open_invite=false', async () => {
        const props = {
            ...defaultProps,
            team: TestHelper.getTeamMock({id: 'team_id', type: 'O', allow_open_invite: true, policy_enforced: false}),
        };
        renderWithContext(<AccessTab {...props}/>);
        await userEvent.click(screen.getByText('Private Team'));
        await userEvent.click(screen.getByTestId('SaveChangesPanel__save-btn'));
        expect(patchTeam).toHaveBeenCalledWith({id: 'team_id', allow_open_invite: false});
    });

    test('non-ABAC team: selecting Public patches allow_open_invite=true', async () => {
        const props = {
            ...defaultProps,
            team: TestHelper.getTeamMock({id: 'team_id', type: 'O', allow_open_invite: false, policy_enforced: false}),
        };
        renderWithContext(<AccessTab {...props}/>);
        await userEvent.click(screen.getByText('Public Team'));
        await userEvent.click(screen.getByTestId('SaveChangesPanel__save-btn'));
        expect(patchTeam).toHaveBeenCalledWith({id: 'team_id', allow_open_invite: true});
    });

    test('ABAC-governed team: Public to Private confirms and patches allow_open_invite=false', async () => {
        const props = {
            ...defaultProps,
            team: TestHelper.getTeamMock({id: 'team_id', type: 'O', allow_open_invite: true, policy_enforced: true}),
            teamMembershipAccessControlEnabled: true,
        };
        renderWithContext(<AccessTab {...props}/>);
        await userEvent.click(screen.getByText('Private Team'));

        // Public -> Private on a governed team opens the mode-flip confirmation.
        await userEvent.click(await screen.findByText('Switch to Private'));
        await userEvent.click(screen.getByTestId('SaveChangesPanel__save-btn'));

        // Privacy is written via patchTeam on every path — team.type is never synced.
        expect(patchTeam).toHaveBeenCalledWith({id: 'team_id', allow_open_invite: false});
    });

    test('ABAC-governed team: selecting Public patches allow_open_invite=true', async () => {
        const props = {
            ...defaultProps,
            team: TestHelper.getTeamMock({id: 'team_id', type: 'I', allow_open_invite: false, policy_enforced: true}),
            teamMembershipAccessControlEnabled: true,
        };
        renderWithContext(<AccessTab {...props}/>);
        await userEvent.click(screen.getByText('Public Team'));
        await userEvent.click(screen.getByTestId('SaveChangesPanel__save-btn'));
        expect(patchTeam).toHaveBeenCalledWith({id: 'team_id', allow_open_invite: true});
    });

    test('stale policy but team ABAC disabled: patches allow_open_invite=false', async () => {
        // policy_enforced is a pure DB-existence flag; with the feature off (license
        // downgrade / flag off) a leftover policy row still uses the same patchTeam path.
        const props = {
            ...defaultProps,
            team: TestHelper.getTeamMock({id: 'team_id', type: 'O', allow_open_invite: true, policy_enforced: true}),
            teamMembershipAccessControlEnabled: false,
        };
        renderWithContext(<AccessTab {...props}/>);
        await userEvent.click(screen.getByText('Private Team'));
        await userEvent.click(screen.getByTestId('SaveChangesPanel__save-btn'));
        expect(patchTeam).toHaveBeenCalledWith({id: 'team_id', allow_open_invite: false});
    });

    test('auto-add-ON governed public team: Private card opens mode-flip modal (not trapped)', async () => {
        const props = {
            ...defaultProps,
            team: TestHelper.getTeamMock({
                id: 'team_id',
                type: 'O',
                allow_open_invite: true,
                policy_enforced: true,
                policy_is_active: true,
            }),
            teamMembershipAccessControlEnabled: true,
        };
        renderWithContext(<AccessTab {...props}/>);
        await userEvent.click(screen.getByText('Private Team'));
        expect(await screen.findByText('Switch to Private Team?')).toBeInTheDocument();
        expect(await screen.findByText('Switch to Private')).toBeInTheDocument();
    });

    test('parent-policy governed team: mode-flip modal shows the resolved member count', async () => {
        getTeamAccessControlPolicy.mockResolvedValueOnce({
            data: {policy: {id: 'team_id', rules: [], imports: ['parent1']}, enforced: true},
        });
        getAccessControlPolicy.mockResolvedValueOnce({
            data: {
                id: 'parent1',
                rules: [{actions: ['membership'], expression: 'user.attributes.Department == "Engineering"'}],
            },
        });
        searchUsersForExpression.mockResolvedValueOnce({data: {users: [], total: 9}});
        getTeamStats.mockResolvedValueOnce({data: {total_member_count: 10, active_member_count: 10}});

        const props = {
            ...defaultProps,
            team: TestHelper.getTeamMock({id: 'team_id', type: 'O', allow_open_invite: true, policy_enforced: true}),
            teamMembershipAccessControlEnabled: true,
        };
        renderWithContext(<AccessTab {...props}/>);
        await userEvent.click(screen.getByText('Private Team'));

        expect(await screen.findByText(/1 current member does not meet criteria/i)).toBeInTheDocument();
        expect(getAccessControlPolicy).toHaveBeenCalledWith('parent1');
        expect(searchUsersForExpression).toHaveBeenCalledWith(
            'user.attributes.Department == "Engineering"', '', '', 1, undefined, 'team_id',
        );
    });

    test('parent-policy fetch failure: modal falls back to the generic message', async () => {
        getTeamAccessControlPolicy.mockResolvedValueOnce({
            data: {policy: {id: 'team_id', rules: [], imports: ['parent1']}, enforced: true},
        });
        getAccessControlPolicy.mockResolvedValueOnce({error: {message: 'boom'}});

        const props = {
            ...defaultProps,
            team: TestHelper.getTeamMock({id: 'team_id', type: 'O', allow_open_invite: true, policy_enforced: true}),
            teamMembershipAccessControlEnabled: true,
        };
        renderWithContext(<AccessTab {...props}/>);
        await userEvent.click(screen.getByText('Private Team'));

        expect(await screen.findByText(/Some members may not meet/i)).toBeInTheDocument();
        expect(screen.queryByText(/do not meet criteria/i)).not.toBeInTheDocument();
    });

    test('own-rules governed team: mode-flip modal counts from the inline expression', async () => {
        getTeamAccessControlPolicy.mockResolvedValueOnce({
            data: {
                policy: {
                    id: 'team_id',
                    imports: [],
                    rules: [{actions: ['membership'], expression: 'user.attributes.Department == "Engineering"'}],
                },
                enforced: true,
            },
        });
        searchUsersForExpression.mockResolvedValueOnce({data: {users: [], total: 8}});
        getTeamStats.mockResolvedValueOnce({data: {total_member_count: 10, active_member_count: 10}});

        const props = {
            ...defaultProps,
            team: TestHelper.getTeamMock({id: 'team_id', type: 'O', allow_open_invite: true, policy_enforced: true}),
            teamMembershipAccessControlEnabled: true,
        };
        renderWithContext(<AccessTab {...props}/>);
        await userEvent.click(screen.getByText('Private Team'));

        expect(await screen.findByText(/2 current members do not meet criteria/i)).toBeInTheDocument();
        expect(getAccessControlPolicy).not.toHaveBeenCalled();
    });

    test('governed team with all members qualifying: modal shows a no-removals reassurance', async () => {
        getTeamAccessControlPolicy.mockResolvedValueOnce({
            data: {
                policy: {
                    id: 'team_id',
                    imports: [],
                    rules: [{actions: ['membership'], expression: 'user.attributes.Department == "Engineering"'}],
                },
                enforced: true,
            },
        });
        searchUsersForExpression.mockResolvedValueOnce({data: {users: [], total: 10}});
        getTeamStats.mockResolvedValueOnce({data: {total_member_count: 10, active_member_count: 10}});

        const props = {
            ...defaultProps,
            team: TestHelper.getTeamMock({id: 'team_id', type: 'O', allow_open_invite: true, policy_enforced: true}),
            teamMembershipAccessControlEnabled: true,
        };
        renderWithContext(<AccessTab {...props}/>);
        await userEvent.click(screen.getByText('Private Team'));

        expect(await screen.findByText(/no one will be removed/i)).toBeInTheDocument();
        expect(screen.queryByText(/do not meet criteria/i)).not.toBeInTheDocument();
    });
});
