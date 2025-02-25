// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';
import {act} from 'react-dom/test-utils';

import {Permissions} from 'mattermost-redux/constants';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import AccessTab from './team_access_tab';

describe('components/TeamSettings', () => {
    const getTeam = jest.fn().mockResolvedValue({data: true});
    const patchTeam = jest.fn().mockReturnValue({data: true});
    const regenerateTeamInviteId = jest.fn().mockReturnValue({data: true});
    const removeTeamIcon = jest.fn().mockReturnValue({data: true});
    const setTeamIcon = jest.fn().mockReturnValue({data: true});
    const baseActions = {
        getTeam,
        patchTeam,
        regenerateTeamInviteId,
        removeTeamIcon,
        setTeamIcon,
    };
    const defaultProps: ComponentProps<typeof AccessTab> = {
        team: TestHelper.getTeamMock({id: 'team_id'}),
        closeModal: jest.fn(),
        actions: baseActions,
        hasChanges: true,
        hasChangeTabError: false,
        setHasChanges: jest.fn(),
        setHasChangeTabError: jest.fn(),
        collapseModal: jest.fn(),
    };

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
        const allowedDomainsInput = screen.getAllByRole('textbox')[0];
        const newDomain = 'best.com';
        await act(async () => {
            await allowedDomainsInput.focus();
            await userEvent.type(allowedDomainsInput, `${newDomain},`);
        });

        const newDomainText = screen.getByText(newDomain);
        expect(newDomainText).toBeInTheDocument();

        const saveButton = screen.getByTestId('mm-save-changes-panel__save-btn');
        await act(async () => {
            userEvent.click(saveButton);
        });
        expect(baseActions.patchTeam).toHaveBeenCalledTimes(1);
        expect(baseActions.patchTeam).toHaveBeenCalledWith({
            allowed_domains: 'test.com, best.com',
            id: defaultProps.team?.id,
        });
    });

    test('MM-62891 should toggle the right checkboxes when their labels are clicked on', () => {
        renderWithContext(<AccessTab {...defaultProps}/>);

        expect(screen.getByRole('checkbox', {name: 'Allow only users with a specific email domain to join this team'})).not.toBeChecked();
        expect(screen.getByRole('checkbox', {name: 'Allow any user with an account on this server to join this team'})).not.toBeChecked();

        userEvent.click(screen.getByText('Allow only users with a specific email domain to join this team'));

        expect(screen.getByRole('checkbox', {name: 'Allow only users with a specific email domain to join this team'})).toBeChecked();
        expect(screen.getByRole('checkbox', {name: 'Allow any user with an account on this server to join this team'})).not.toBeChecked();

        userEvent.click(screen.getByText('Allow only users with a specific email domain to join this team'));

        expect(screen.getByRole('checkbox', {name: 'Allow only users with a specific email domain to join this team'})).not.toBeChecked();
        expect(screen.getByRole('checkbox', {name: 'Allow any user with an account on this server to join this team'})).not.toBeChecked();

        userEvent.click(screen.getByText('Allow any user with an account on this server to join this team'));

        expect(screen.getByRole('checkbox', {name: 'Allow only users with a specific email domain to join this team'})).not.toBeChecked();
        expect(screen.getByRole('checkbox', {name: 'Allow any user with an account on this server to join this team'})).toBeChecked();

        userEvent.click(screen.getByText('Allow any user with an account on this server to join this team'));

        expect(screen.getByRole('checkbox', {name: 'Allow only users with a specific email domain to join this team'})).not.toBeChecked();
        expect(screen.getByRole('checkbox', {name: 'Allow any user with an account on this server to join this team'})).not.toBeChecked();
    });
});
