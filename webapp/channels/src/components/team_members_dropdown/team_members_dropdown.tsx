// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {Team, TeamMembership} from '@mattermost/types/teams';
import {UserProfile} from '@mattermost/types/users';
import {ActionFunc} from 'mattermost-redux/types/actions';
import type {isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';

import {getHistory} from 'utils/browser_history';
import * as Utils from 'utils/utils';
import {isGuest, isAdmin, isSystemAdmin} from 'mattermost-redux/utils/user_utils';
import ConfirmModal from 'components/confirm_modal';
import DropdownIcon from 'components/widgets/icons/fa_dropdown_icon';

import Menu from 'components/widgets/menu/menu';
import MenuWrapper from 'components/widgets/menu/menu_wrapper';

const ROWS_FROM_BOTTOM_TO_OPEN_UP = 3;

type Props = {
    user: UserProfile;
    currentUser: UserProfile;
    teamMember: TeamMembership;
    teamUrl: string;
    currentTeam: Team;
    index: number;
    totalUsers: number;
    collapsedThreads: ReturnType<typeof isCollapsedThreadsEnabled>;
    actions: {
        getMyTeamMembers: () => void;
        getMyTeamUnreads: (collapsedThreads: boolean) => void;
        getUser: (id: string) => void;
        getTeamMember: (teamId: string, userId: string) => void;
        getTeamStats: (teamId: string) => ActionFunc;
        getChannelStats: (channelId: string) => void;
        updateTeamMemberSchemeRoles: (teamId: string, userId: string, b1: boolean, b2: boolean) => ActionFunc & Partial<{error: Error}>;
        updateUserActive: (userId: string, active: boolean) => ActionFunc;
        removeUserFromTeamAndGetStats: (teamId: string, userId: string) => ActionFunc & Partial<{error: Error}>;
    };
};

type State = {
    serverError: string|null;
    showDemoteModal: boolean;
    user: UserProfile|null;
    role: string|null;
}

export default class TeamMembersDropdown extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            serverError: null,
            showDemoteModal: false,
            user: null,
            role: null,
        };
    }

    private handleMakeMember = async () => {
        const me = this.props.currentUser;
        if (this.props.user.id === me.id && me.roles.includes('system_admin')) {
            this.handleDemote(this.props.user, 'team_user');
        } else {
            const {error} = await this.props.actions.updateTeamMemberSchemeRoles(this.props.teamMember.team_id, this.props.user.id, true, false);
            if (error) {
                this.setState({serverError: error.message});
            } else {
                this.props.actions.getUser(this.props.user.id);
                this.props.actions.getTeamMember(this.props.teamMember.team_id, this.props.user.id);
                if (this.props.user.id === me.id) {
                    await this.props.actions.getMyTeamMembers();
                    this.props.actions.getMyTeamUnreads(this.props.collapsedThreads);
                }
            }
        }
    };

    private handleRemoveFromTeam = async () => {
        const {error} = await this.props.actions.removeUserFromTeamAndGetStats(this.props.teamMember.team_id, this.props.user.id);
        if (error) {
            this.setState({serverError: error.message});
        }
    };

    private handleMakeAdmin = async () => {
        const me = this.props.currentUser;
        if (this.props.user.id === me.id && me.roles.includes('system_admin')) {
            this.handleDemote(this.props.user, 'team_user team_admin');
        } else {
            const {error} = await this.props.actions.updateTeamMemberSchemeRoles(this.props.teamMember.team_id, this.props.user.id, true, true);
            if (error) {
                this.setState({serverError: error.message});
            } else {
                this.props.actions.getUser(this.props.user.id);
                this.props.actions.getTeamMember(this.props.teamMember.team_id, this.props.user.id);
            }
        }
    };

    private handleDemote = (user: UserProfile, role: string): void => {
        this.setState({
            serverError: this.state.serverError,
            showDemoteModal: true,
            user,
            role,
        });
    };

    private handleDemoteCancel = (): void => {
        this.setState({
            serverError: null,
            showDemoteModal: false,
            user: null,
            role: null,
        });
    };

    private handleDemoteSubmit = async () => {
        const {error} = await this.props.actions.updateTeamMemberSchemeRoles(this.props.teamMember.team_id, this.props.user.id, true, false);
        if (error) {
            this.setState({serverError: error.message});
        } else {
            this.props.actions.getUser(this.props.user.id);
            getHistory().push(this.props.teamUrl);
        }
    };

    render() {
        let serverError = null;
        if (this.state.serverError) {
            serverError = (
                <div className='has-error'>
                    <label className='has-error control-label'>{this.state.serverError}</label>
                </div>
            );
        }

        const {currentTeam, teamMember, user} = this.props;

        let currentRoles = null;

        if (isGuest(user.roles)) {
            currentRoles = (
                <FormattedMessage
                    id='team_members_dropdown.guest'
                    defaultMessage='Guest'
                />
            );
        } else if (user.roles.length > 0 && isSystemAdmin(user.roles)) {
            currentRoles = (
                <FormattedMessage
                    id='team_members_dropdown.systemAdmin'
                    defaultMessage='System Admin'
                />
            );
        } else if ((teamMember.roles.length > 0 && isAdmin(teamMember.roles)) || teamMember.scheme_admin) {
            currentRoles = (
                <FormattedMessage
                    id='team_members_dropdown.teamAdmin'
                    defaultMessage='Team Admin'
                />
            );
        } else {
            currentRoles = (
                <FormattedMessage
                    id='team_members_dropdown.member'
                    defaultMessage='Member'
                />
            );
        }

        const me = this.props.currentUser;
        let showMakeMember = !isGuest(user.roles) && (isAdmin(teamMember.roles) || teamMember.scheme_admin) && !isSystemAdmin(user.roles);
        let showMakeAdmin = !isGuest(user.roles) && !isAdmin(teamMember.roles) && !isSystemAdmin(user.roles) && !teamMember.scheme_admin;

        if (user.delete_at > 0) {
            currentRoles = (
                <FormattedMessage
                    id='team_members_dropdown.inactive'
                    defaultMessage='Inactive'
                />
            );
            showMakeMember = false;
            showMakeAdmin = false;
        }

        const canRemoveFromTeam = user.id !== me.id && (!currentTeam.group_constrained || user.is_bot);

        let makeDemoteModal = null;
        if (user.id === me.id) {
            const title = (
                <FormattedMessage
                    id='team_members_dropdown.confirmDemoteRoleTitle'
                    defaultMessage='Confirm Demotion from System Admin Role'
                />
            );

            const message = (
                <div>
                    <FormattedMessage
                        id='team_members_dropdown.confirmDemoteDescription'
                        defaultMessage="If you demote yourself from the System Admin role and there is not another user with System Admin privileges, you'll need to re-assign a System Admin by accessing the Mattermost server through a terminal and running the following command."
                    />
                    <br/>
                    <br/>
                    <FormattedMessage
                        id='team_members_dropdown.confirmDemotionCmd'
                        defaultMessage='platform roles system_admin {username}'
                        values={{
                            username: me.username,
                        }}
                    />
                    {serverError}
                </div>
            );

            const confirmButton = (
                <FormattedMessage
                    id='team_members_dropdown.confirmDemotion'
                    defaultMessage='Confirm Demotion'
                />
            );

            makeDemoteModal = (
                <ConfirmModal
                    show={this.state.showDemoteModal}
                    title={title}
                    message={message}
                    confirmButtonText={confirmButton}
                    onConfirm={this.handleDemoteSubmit}
                    onCancel={this.handleDemoteCancel}
                />
            );
        }

        if (!canRemoveFromTeam && !showMakeAdmin && !showMakeMember) {
            return <div>{currentRoles}</div>;
        }

        const {index, totalUsers} = this.props;
        let openUp = false;
        if (totalUsers > ROWS_FROM_BOTTOM_TO_OPEN_UP && totalUsers - index <= ROWS_FROM_BOTTOM_TO_OPEN_UP) {
            openUp = true;
        }

        const menuRemove = (
            <Menu.ItemAction
                id='removeFromTeam'
                onClick={this.handleRemoveFromTeam}
                text={Utils.localizeMessage('team_members_dropdown.leave_team', 'Remove From Team')}
            />
        );
        const menuMakeAdmin = (
            <Menu.ItemAction
                onClick={this.handleMakeAdmin}
                text={Utils.localizeMessage('team_members_dropdown.makeAdmin', 'Make Team Admin')}
            />
        );
        const menuMakeMember = (
            <Menu.ItemAction
                onClick={this.handleMakeMember}
                text={Utils.localizeMessage('team_members_dropdown.makeMember', 'Make Member')}
            />
        );
        return (
            <MenuWrapper>
                <button
                    id={`teamMembersDropdown_${user.username}`}
                    className='dropdown-toggle theme color--link style--none'
                    type='button'
                    aria-expanded='true'
                >
                    <span>{currentRoles} </span>
                    <DropdownIcon/>
                </button>
                <div>
                    <Menu
                        openLeft={true}
                        openUp={openUp}
                        ariaLabel={Utils.localizeMessage('team_members_dropdown.menuAriaLabel', 'Change the role of a team member')}
                    >
                        {canRemoveFromTeam ? menuRemove : null}
                        {showMakeAdmin ? menuMakeAdmin : null}
                        {showMakeMember ? menuMakeMember : null}
                    </Menu>
                    {makeDemoteModal}
                    {serverError}
                </div>
            </MenuWrapper>
        );
    }
}
