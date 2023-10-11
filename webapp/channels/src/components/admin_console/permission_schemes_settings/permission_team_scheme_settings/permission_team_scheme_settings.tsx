// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import type {RouteComponentProps} from 'react-router-dom';

import type {ClientConfig, ClientLicense} from '@mattermost/types/config';
import type {ServerError} from '@mattermost/types/errors';
import type {Role} from '@mattermost/types/roles';
import type {Scheme, SchemePatch} from '@mattermost/types/schemes';
import type {Team} from '@mattermost/types/teams';

import GeneralConstants from 'mattermost-redux/constants/general';
import type {ActionFunc, ActionResult} from 'mattermost-redux/types/actions';

import BlockableLink from 'components/admin_console/blockable_link';
import ExternalLink from 'components/external_link';
import FormError from 'components/form_error';
import LoadingScreen from 'components/loading_screen';
import LocalizedInput from 'components/localized_input/localized_input';
import SaveButton from 'components/save_button';
import TeamSelectorModal from 'components/team_selector_modal';
import AdminHeader from 'components/widgets/admin_console/admin_header';
import AdminPanel from 'components/widgets/admin_console/admin_panel';
import AdminPanelTogglable from 'components/widgets/admin_console/admin_panel_togglable';
import AdminPanelWithButton from 'components/widgets/admin_console/admin_panel_with_button';

import {PermissionsScope, ModalIdentifiers, DocLinks} from 'utils/constants';
import {t} from 'utils/i18n';
import {localizeMessage} from 'utils/utils';

import TeamInList from './team_in_list';

import GuestPermissionsTree, {GUEST_INCLUDED_PERMISSIONS} from '../guest_permissions_tree';
import PermissionsTree, {EXCLUDED_PERMISSIONS} from '../permissions_tree';
import PermissionsTreePlaybooks from '../permissions_tree_playbooks';

type RolesMap = {
    [x: string]: Role;
};

export type Props = {
    schemeId: string;
    scheme: Scheme | null;
    roles: RolesMap;
    license: ClientLicense;
    teams: Team[];
    isDisabled: boolean;
    config: Partial<ClientConfig>;
    actions: {
        loadRolesIfNeeded: (roles: Iterable<string>) => ActionFunc;
        loadScheme: (schemeId: string) => Promise<ActionResult>;
        loadSchemeTeams: (schemeId: string, page?: number, perPage?: number) => ActionFunc;
        editRole: (role: Role) => Promise<{error: ServerError}>;
        patchScheme: (schemeId: string, scheme: SchemePatch) => ActionFunc;
        updateTeamScheme: (teamId: string, schemeId: string) => Promise<{error: ServerError; data: Scheme}>;
        createScheme: (scheme: Scheme) => Promise<{error: ServerError; data: Scheme}>;
        setNavigationBlocked: (blocked: boolean) => void;
    };
}

type State = {
    saving: boolean;
    saveNeeded: boolean;
    serverError: string | null;
    roles: {
        [x: string]: Role;
    } | null;
    teams: Team[] | null;
    addTeamOpen: boolean;
    selectedPermission: string | undefined;
    openRoles: {
        all_users: boolean;
        team_admin: boolean;
        channel_admin: boolean;
        playbook_admin: boolean;
        guests: boolean;
    };
    urlParams: URLSearchParams;
    schemeName: string | undefined;
    schemeDescription: string | undefined;
};

export default class PermissionTeamSchemeSettings extends React.PureComponent<Props & RouteComponentProps, State> {
    constructor(props: Props & RouteComponentProps) {
        super(props);
        this.state = {
            saving: false,
            saveNeeded: false,
            serverError: null,
            roles: null,
            teams: null,
            addTeamOpen: false,
            selectedPermission: undefined,
            openRoles: {
                all_users: true,
                team_admin: true,
                channel_admin: true,
                playbook_admin: true,
                guests: true,
            },
            urlParams: new URLSearchParams(props.location.search),
            schemeName: undefined,
            schemeDescription: undefined,
        };
    }

    static defaultProps = {
        scheme: null,
    };

    componentDidMount() {
        const rolesNeeded = [
            GeneralConstants.TEAM_GUEST_ROLE,
            GeneralConstants.TEAM_USER_ROLE,
            GeneralConstants.TEAM_ADMIN_ROLE,
            GeneralConstants.CHANNEL_GUEST_ROLE,
            GeneralConstants.CHANNEL_USER_ROLE,
            GeneralConstants.CHANNEL_ADMIN_ROLE,
            GeneralConstants.PLAYBOOK_ADMIN_ROLE,
            GeneralConstants.PLAYBOOK_MEMBER_ROLE,
            GeneralConstants.RUN_MEMBER_ROLE,
        ];
        this.props.actions.loadRolesIfNeeded(rolesNeeded);
        if (this.props.schemeId) {
            this.props.actions.loadScheme(this.props.schemeId).then((result) => {
                this.props.actions.loadRolesIfNeeded([
                    result.data.default_team_guest_role,
                    result.data.default_team_user_role,
                    result.data.default_team_admin_role,
                    result.data.default_channel_guest_role,
                    result.data.default_channel_user_role,
                    result.data.default_channel_admin_role,
                    result.data.default_playbook_admin_role,
                    result.data.default_playbook_member_role,
                    result.data.default_run_member_role,
                ]);
            });
            this.props.actions.loadSchemeTeams(this.props.schemeId);
        }

        const rowIdFromQuery = this.state.urlParams.get('rowIdFromQuery');
        if (rowIdFromQuery) {
            setTimeout(() => {
                this.selectRow(rowIdFromQuery);
            }, 1000);
        }
    }

    isLoaded = (props: Props) => {
        if (props.schemeId) {
            if (props.scheme !== null &&
                props.teams !== null &&
                props.roles[props.scheme.default_team_guest_role] &&
                props.roles[props.scheme.default_team_user_role] &&
                props.roles[props.scheme.default_team_admin_role] &&
                props.roles[props.scheme.default_channel_guest_role] &&
                props.roles[props.scheme.default_channel_user_role] &&
                props.roles[props.scheme.default_channel_admin_role] &&
                props.roles[props.scheme.default_playbook_admin_role] &&
                props.roles[props.scheme.default_playbook_member_role] &&
                props.roles[props.scheme.default_run_member_role]) {
                return true;
            }
            return false;
        } else if (props.roles.team_guest &&
            props.roles.team_user &&
            props.roles.team_admin &&
            props.roles.channel_guest &&
            props.roles.channel_user &&
            props.roles.channel_admin &&
            props.roles.playbook_admin &&
            props.roles.playbook_member &&
            props.roles.run_member) {
            return true;
        }
        return false;
    };

    goToSelectedRow = () => {
        const selected = document.querySelector('.permission-row.selected,.permission-group-row.selected');
        if (selected) {
            if (this.state.openRoles.all_users) {
                selected.scrollIntoView({behavior: 'smooth', block: 'center'});
            } else {
                this.toggleRole('all_users');

                // Give it time to open and show everything
                setTimeout(() => {
                    selected.scrollIntoView({behavior: 'smooth', block: 'center'});
                }, 300);
            }
            return true;
        }
        return false;
    };

    selectRow = (permission: string) => {
        this.setState({selectedPermission: permission});

        // Wait until next render
        setTimeout(this.goToSelectedRow);

        // Remove selection after animation
        setTimeout(() => {
            this.setState({selectedPermission: undefined});
        }, 3000);
    };

    getStateRoles = () => {
        if (this.state.roles !== null) {
            return this.state.roles;
        }

        let teamGuest;
        let teamUser;
        let teamAdmin;
        let channelGuest;
        let channelUser;
        let channelAdmin;
        let playbookAdmin;
        let playbookMember;
        let runMember;

        if (this.props.schemeId && this.props.scheme) {
            if (this.isLoaded(this.props)) {
                teamGuest = this.props.roles[this.props.scheme.default_team_guest_role];
                teamUser = this.props.roles[this.props.scheme.default_team_user_role];
                teamAdmin = this.props.roles[this.props.scheme.default_team_admin_role];
                channelGuest = this.props.roles[this.props.scheme.default_channel_guest_role];
                channelUser = this.props.roles[this.props.scheme.default_channel_user_role];
                channelAdmin = this.props.roles[this.props.scheme.default_channel_admin_role];
                playbookAdmin = this.props.roles[this.props.scheme.default_playbook_admin_role];
                playbookMember = this.props.roles[this.props.scheme.default_playbook_member_role];
                runMember = this.props.roles[this.props.scheme.default_run_member_role];
            }
        } else if (this.isLoaded(this.props)) {
            teamGuest = this.props.roles.team_guest;
            teamUser = this.props.roles.team_user;
            teamAdmin = this.props.roles.team_admin;
            channelGuest = this.props.roles.channel_guest;
            channelUser = this.props.roles.channel_user;
            channelAdmin = this.props.roles.channel_admin;
            playbookAdmin = this.props.roles.playbook_admin;
            playbookMember = this.props.roles.playbook_member;
            runMember = this.props.roles.run_member;
        } else {
            return null;
        }
        return {
            team_admin: teamAdmin,
            channel_admin: channelAdmin,
            playbook_admin: playbookAdmin,
            playbook_member: playbookMember,
            run_member: runMember,
            team_guest: teamGuest,
            team_user: teamUser,
            channel_guest: channelGuest,
            channel_user: channelUser,
            all_users: {
                name: 'all_users',
                displayName: 'All members',
                permissions: [
                    ...(teamUser?.permissions || []),
                    ...(channelUser?.permissions || []),
                    ...(playbookMember?.permissions || []),
                    ...(runMember?.permissions || []),
                ],
            },
            guests: {
                name: 'guests',
                displayName: 'Guests',
                permissions: teamGuest?.permissions.concat(channelGuest?.permissions || []),
            },
        };
    };

    deriveRolesFromGuests = (teamGuest: Role, channelGuest: Role, role: Role): RolesMap => {
        return {
            team_guest: {
                ...teamGuest,
                permissions: role.permissions.filter((p) => PermissionsScope[p] === 'team_scope'),
            },
            channel_guest: {
                ...channelGuest,
                permissions: role.permissions.filter((p) => PermissionsScope[p] === 'channel_scope'),
            },
        };
    };

    restoreGuestPermissions = (teamGuest: Role, channelGuest: Role, roles: RolesMap) => {
        for (const permission of teamGuest.permissions) {
            if (!GUEST_INCLUDED_PERMISSIONS.includes(permission)) {
                roles.team_guest.permissions.push(permission);
            }
        }
        for (const permission of channelGuest.permissions) {
            if (!GUEST_INCLUDED_PERMISSIONS.includes(permission)) {
                roles.channel_guest.permissions.push(permission);
            }
        }
        return roles;
    };

    deriveRolesFromAllUsers = (baseTeam: Role, baseChannel: Role, basePlaybookMember: Role, baseRunMember: Role, role: Role): RolesMap => {
        return {
            team_user: {
                ...baseTeam,
                permissions: role.permissions.filter((p) => PermissionsScope[p] === 'team_scope'),
            },
            channel_user: {
                ...baseChannel,
                permissions: role.permissions.filter((p) => PermissionsScope[p] === 'channel_scope'),
            },
            playbook_member: {
                ...basePlaybookMember,
                permissions: role.permissions?.filter((p) => PermissionsScope[p] === 'playbook_scope'),
            },
            run_member: {
                ...baseRunMember,
                permissions: role.permissions?.filter((p) => PermissionsScope[p] === 'run_scope'),
            },
        };
    };

    restoreExcludedPermissions = (baseTeam: Role, baseChannel: Role, roles: RolesMap) => {
        for (const permission of baseTeam.permissions) {
            if (EXCLUDED_PERMISSIONS.includes(permission)) {
                roles.team_user.permissions.push(permission);
            }
        }
        for (const permission of baseChannel.permissions) {
            if (EXCLUDED_PERMISSIONS.includes(permission)) {
                roles.channel_user.permissions.push(permission);
            }
        }
        return roles;
    };

    handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({schemeName: e.target.value, saveNeeded: true});
        this.props.actions.setNavigationBlocked(true);
    };

    handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        this.setState({schemeDescription: e.target.value, saveNeeded: true});
        this.props.actions.setNavigationBlocked(true);
    };

    handleSubmit = async () => {
        const roles = this.getStateRoles();
        let teamAdmin = roles?.team_admin;
        let channelAdmin = roles?.channel_admin;
        let playbookAdmin = roles?.playbook_admin;
        let playbookMember = roles?.playbook_member;
        let runMember = roles?.run_member;
        const allUsers = roles?.all_users;
        const guests = roles?.guests;

        const schemeName = this.state.schemeName || (this.props.scheme && this.props.scheme.display_name) || '';
        const schemeDescription = this.state.schemeDescription || (this.props.scheme && this.props.scheme.description) || '';
        let teamUser = null;
        let channelUser = null;
        let teamGuest = null;
        let channelGuest = null;
        let schemeId = null;

        this.setState({saving: true});

        if (roles && roles.team_user && roles.channel_user && roles.playbook_member && roles.run_member && allUsers) {
            let derived = this.deriveRolesFromAllUsers(
                roles.team_user,
                roles.channel_user,
                roles.playbook_member,
                roles.run_member,
                allUsers as Role,
            ) as any;
            derived = this.restoreExcludedPermissions(
                roles.team_user,
                roles.channel_user,
                derived,
            );
            teamUser = derived.team_user;
            channelUser = derived.channel_user;
            playbookMember = derived.playbook_member;
            runMember = derived.run_member;
        }

        if (roles && roles.team_guest && roles.channel_guest && guests) {
            let derivedGuests = this.deriveRolesFromGuests(
                roles.team_guest,
                roles.channel_guest,
                guests as Role,
            );
            derivedGuests = this.restoreGuestPermissions(
                roles.team_guest,
                roles.channel_guest,
                derivedGuests,
            );
            teamGuest = derivedGuests.team_guest;
            channelGuest = derivedGuests.channel_guest;
        }

        if (this.props.schemeId) {
            await this.props.actions.patchScheme(this.props.schemeId, {
                display_name: schemeName,
                description: schemeDescription,
            } as SchemePatch);
            schemeId = this.props.schemeId;
        } else {
            const result = await this.props.actions.createScheme({
                display_name: schemeName,
                description: schemeDescription,
                scope: 'team',
            } as Scheme);
            if (result.error) {
                this.setState({serverError: result.error.message, saving: false, saveNeeded: true});
                this.props.actions.setNavigationBlocked(true);
                return;
            }
            const newScheme = result.data;
            schemeId = newScheme.id;
            await this.props.actions.loadRolesIfNeeded([
                newScheme.default_team_guest_role,
                newScheme.default_team_user_role,
                newScheme.default_team_admin_role,
                newScheme.default_channel_guest_role,
                newScheme.default_channel_user_role,
                newScheme.default_channel_admin_role,
                newScheme.default_playbook_admin_role,
                newScheme.default_playbook_member_role,
                newScheme.default_run_member_role,
            ]);
            teamGuest = {...teamGuest, id: this.props.roles[newScheme.default_team_guest_role].id};
            teamUser = {...teamUser, id: this.props.roles[newScheme.default_team_user_role].id};
            teamAdmin = {...teamAdmin, id: this.props.roles[newScheme.default_team_admin_role].id} as Role;
            channelGuest = {...channelGuest, id: this.props.roles[newScheme.default_channel_guest_role].id};
            channelUser = {...channelUser, id: this.props.roles[newScheme.default_channel_user_role].id};
            channelAdmin = {...channelAdmin, id: this.props.roles[newScheme.default_channel_admin_role].id} as Role;
            playbookAdmin = {...playbookAdmin, id: this.props.roles[newScheme.default_playbook_admin_role].id} as Role;
            playbookMember = {...playbookMember, id: this.props.roles[newScheme.default_playbook_member_role].id} as Role;
            runMember = {...runMember, id: this.props.roles[newScheme.default_run_member_role].id} as Role;
        }

        const teamAdminPromise = this.props.actions.editRole(teamAdmin as Role);
        const channelAdminPromise = this.props.actions.editRole(channelAdmin as Role);
        const playbookAdminPromise = this.props.actions.editRole(playbookAdmin as Role);
        const playbookMemberPromise = this.props.actions.editRole(playbookMember as Role);
        const runMemberPromise = this.props.actions.editRole(runMember as Role);
        const promises = [teamAdminPromise, channelAdminPromise, playbookAdminPromise, playbookMemberPromise, runMemberPromise];

        const teamUserPromise = this.props.actions.editRole(teamUser);
        const channelUserPromise = this.props.actions.editRole(channelUser);
        promises.push(teamUserPromise);
        promises.push(channelUserPromise);

        if (this.haveGuestAccountsPermissions()) {
            const teamGuestPromise = this.props.actions.editRole(teamGuest as Role);
            const channelGuestPromise = this.props.actions.editRole(channelGuest as Role);
            promises.push(teamGuestPromise, channelGuestPromise);
        }

        const currentTeams = new Set((this.state.teams || this.props.teams || []).map((team) => team.id));
        const serverTeams = new Set((this.props.teams || []).map((team) => team.id));

        // Difference of sets (currentTeams - serverTeams)
        const addedTeams = new Set([...currentTeams].filter((team) => !serverTeams.has(team)));

        // Difference of sets (serverTeams - currentTeams)
        const removedTeams = new Set([...serverTeams].filter((team) => !currentTeams.has(team)));

        for (const teamId of addedTeams) {
            promises.push(this.props.actions.updateTeamScheme(teamId, schemeId));
        }

        for (const teamId of removedTeams) {
            promises.push(this.props.actions.updateTeamScheme(teamId, ''));
        }

        const results = await Promise.all(promises);

        let serverError = null;
        let saveNeeded = false;
        for (const result of results) {
            if (result.error) {
                serverError = result.error.message;
                saveNeeded = true;
                break;
            }
        }

        this.setState({serverError, saving: false, saveNeeded});
        this.props.actions.setNavigationBlocked(saveNeeded);
        this.props.history.push('/admin_console/user_management/permissions');
    };

    toggleRole = (roleId: 'all_users' | 'team_admin' | 'channel_admin' | 'guests' | 'playbook_admin') => {
        const newOpenRoles = {...this.state.openRoles};
        newOpenRoles[roleId] = !newOpenRoles[roleId];
        this.setState({openRoles: newOpenRoles});
    };

    togglePermission = (roleId: string, permissions: string[]) => {
        const roles = {...this.getStateRoles()} as RolesMap;
        let role = null;
        if (roles.team_admin.name === roleId) {
            role = {...roles.team_admin};
        } else if (roles.channel_admin.name === roleId) {
            role = {...roles.channel_admin};
        } else if (roles.all_users.name === roleId) {
            role = {...roles.all_users};
        } else if (roles.guests.name === roleId) {
            role = {...roles.guests};
        } else if (roles.playbook_admin.name === roleId) {
            role = {...roles.playbook_admin};
        }

        if (role) {
            const newPermissions = [...role.permissions];
            for (const permission of permissions) {
                if (newPermissions.indexOf(permission) === -1) {
                    newPermissions.push(permission);
                } else {
                    newPermissions.splice(newPermissions.indexOf(permission), 1);
                }
            }
            role.permissions = newPermissions;
            if (roles.team_admin.name === roleId) {
                roles.team_admin = role;
            } else if (roles.channel_admin.name === roleId) {
                roles.channel_admin = role;
            } else if (roles.all_users.name === roleId) {
                roles.all_users = role;
            } else if (roles.guests.name === roleId) {
                roles.guests = role;
            } else if (roles.playbook_admin.name === roleId) {
                roles.playbook_admin = role;
            }
        }

        this.setState({roles, saveNeeded: true});
        this.props.actions.setNavigationBlocked(true);
    };

    openAddTeam = () => {
        this.setState({addTeamOpen: true});
    };

    removeTeam = (teamId: string) => {
        const teams = (this.state.teams || this.props.teams).filter((team) => team.id !== teamId);
        this.setState({teams, saveNeeded: true});
        this.props.actions.setNavigationBlocked(true);
    };

    addTeams = (teams: Team[]) => {
        const currentTeams = this.state.teams || this.props.teams || [];
        this.setState({
            teams: [...currentTeams, ...teams],
            saveNeeded: true,
        });
        this.props.actions.setNavigationBlocked(true);
    };

    closeAddTeam = () => {
        this.setState({addTeamOpen: false});
    };

    haveGuestAccountsPermissions = () => {
        return this.props.license.GuestAccountsPermissions === 'true';
    };

    render = () => {
        if (!this.isLoaded(this.props)) {
            return <LoadingScreen/>;
        }
        const roles = this.getStateRoles();
        const teams = this.state.teams || this.props.teams || [];
        const schemeName = this.state.schemeName || (this.props.scheme && this.props.scheme.display_name) || '';
        const schemeDescription = this.state.schemeDescription || (this.props.scheme && this.props.scheme.description) || '';
        return (
            <div className='wrapper--fixed'>
                {this.state.addTeamOpen &&
                    <TeamSelectorModal
                        modalID={ModalIdentifiers.ADD_TEAMS_TO_SCHEME}
                        onModalDismissed={this.closeAddTeam}
                        onTeamsSelected={this.addTeams}
                        currentSchemeId={this.props.schemeId}
                        alreadySelected={teams.map((team) => team.id)}
                    />
                }
                <AdminHeader withBackButton={true}>
                    <div>
                        <BlockableLink
                            to='/admin_console/user_management/permissions'
                            className='fa fa-angle-left back'
                        />
                        <FormattedMessage
                            id='admin.permissions.teamScheme'
                            defaultMessage='Team Scheme'
                        />
                    </div>
                </AdminHeader>

                <div className='admin-console__wrapper'>
                    <div className='admin-console__content'>
                        <div className={'banner info'}>
                            <div className='banner__content'>
                                <span>
                                    <FormattedMessage
                                        id='admin.permissions.teamScheme.introBanner'
                                        defaultMessage='<linkTeamOverride>Team Override Schemes</linkTeamOverride> set the permissions for Team Admins, Channel Admins and other members in specific teams. Use a Team Override Scheme when specific teams need permission exceptions to the <linkSystemScheme>System Scheme</linkSystemScheme>.'
                                        values={{
                                            linkTeamOverride: (msg: React.ReactNode) => (
                                                <ExternalLink
                                                    href={DocLinks.ONBOARD_ADVANCED_PERMISSIONS}
                                                    location='permission_team_scheme_settings'
                                                >
                                                    {msg}
                                                </ExternalLink>
                                            ),
                                            linkSystemScheme: (msg: React.ReactNode) => (
                                                <ExternalLink
                                                    href={DocLinks.ONBOARD_ADVANCED_PERMISSIONS}
                                                    location='permission_team_scheme_settings'
                                                >
                                                    {msg}
                                                </ExternalLink>
                                            ),
                                        }}
                                    />
                                </span>
                            </div>
                        </div>

                        <AdminPanel
                            titleId={t('admin.permissions.teamScheme.schemeDetailsTitle')}
                            titleDefault='Scheme Details'
                            subtitleId={t('admin.permissions.teamScheme.schemeDetailsDescription')}
                            subtitleDefault='Set the name and description for this scheme.'
                        >
                            <div className='team-scheme-details'>
                                <div className='form-group'>
                                    <label
                                        className='control-label'
                                        htmlFor='scheme-name'
                                    >
                                        <FormattedMessage
                                            id='admin.permissions.teamScheme.schemeNameLabel'
                                            defaultMessage='Scheme Name:'
                                        />
                                    </label>
                                    <LocalizedInput
                                        id='scheme-name'
                                        className='form-control'
                                        type='text'
                                        value={schemeName}
                                        placeholder={{id: t('admin.permissions.teamScheme.schemeNamePlaceholder'), defaultMessage: 'Scheme Name'}}
                                        onChange={this.handleNameChange}
                                        disabled={this.props.isDisabled}
                                    />
                                </div>
                                <div className='form-group'>
                                    <label
                                        className='control-label'
                                        htmlFor='scheme-description'
                                    >
                                        <FormattedMessage
                                            id='admin.permissions.teamScheme.schemeDescriptionLabel'
                                            defaultMessage='Scheme Description:'
                                        />
                                    </label>
                                    <textarea
                                        id='scheme-description'
                                        className='form-control'
                                        rows={5}
                                        value={schemeDescription}
                                        placeholder={localizeMessage('admin.permissions.teamScheme.schemeDescriptionPlaceholder', 'Scheme Description')}
                                        onChange={this.handleDescriptionChange}
                                        disabled={this.props.isDisabled}
                                    />
                                </div>
                            </div>
                        </AdminPanel>

                        <AdminPanelWithButton
                            className='permissions-block'
                            titleId={t('admin.permissions.teamScheme.selectTeamsTitle')}
                            titleDefault='Select teams to override permissions'
                            subtitleId={t('admin.permissions.teamScheme.selectTeamsDescription')}
                            subtitleDefault='Select teams where permission exceptions are required.'
                            onButtonClick={this.openAddTeam}
                            buttonTextId={t('admin.permissions.teamScheme.addTeams')}
                            buttonTextDefault='Add Teams'
                            disabled={this.props.isDisabled}
                        >
                            <div className='teams-list'>
                                {teams.length === 0 &&
                                    <div className='no-team-schemes'>
                                        <FormattedMessage
                                            id='admin.permissions.teamScheme.noTeams'
                                            defaultMessage='No team selected. Please add teams to this list.'
                                        />
                                    </div>}
                                {teams.map((team) => (
                                    <TeamInList
                                        key={team.id}
                                        team={team}
                                        onRemoveTeam={this.removeTeam}
                                        isDisabled={this.props.isDisabled}
                                    />
                                ))}
                            </div>
                        </AdminPanelWithButton>

                        {this.props.license && this.props.config.EnableGuestAccounts === 'true' &&
                            <AdminPanelTogglable
                                className='permissions-block'
                                open={this.state.openRoles.guests}
                                id='guests'
                                onToggle={() => this.toggleRole('guests')}
                                titleId={t('admin.permissions.systemScheme.GuestsTitle')}
                                titleDefault='Guests'
                                subtitleId={t('admin.permissions.systemScheme.GuestsDescription')}
                                subtitleDefault='Permissions granted to guest users.'
                                isDisabled={this.props.isDisabled}
                            >
                                <GuestPermissionsTree
                                    selected={this.state.selectedPermission}
                                    role={roles?.guests}
                                    scope={'team_scope'}
                                    onToggle={this.togglePermission}
                                    selectRow={this.selectRow}
                                    readOnly={this.props.isDisabled || !this.haveGuestAccountsPermissions()}
                                />
                            </AdminPanelTogglable>
                        }

                        <AdminPanelTogglable
                            className='permissions-block all_users'
                            open={this.state.openRoles.all_users}
                            id='all_users'
                            onToggle={() => this.toggleRole('all_users')}
                            titleId={t('admin.permissions.systemScheme.allMembersTitle')}
                            titleDefault='All Members'
                            subtitleId={t('admin.permissions.systemScheme.allMembersDescription')}
                            subtitleDefault='Permissions granted to all members, including administrators and newly created users.'
                            isDisabled={this.props.isDisabled}
                        >
                            <PermissionsTree
                                selected={this.state.selectedPermission}
                                role={roles?.all_users}
                                scope={'team_scope'}
                                onToggle={this.togglePermission}
                                selectRow={this.selectRow}
                                readOnly={this.props.isDisabled}
                            />
                        </AdminPanelTogglable>

                        <AdminPanelTogglable
                            className='permissions-block channel_admin'
                            open={this.state.openRoles.channel_admin}
                            onToggle={() => this.toggleRole('channel_admin')}
                            titleId={t('admin.permissions.systemScheme.channelAdminsTitle')}
                            titleDefault='Channel Administrators'
                            subtitleId={t('admin.permissions.systemScheme.channelAdminsDescription')}
                            subtitleDefault='Permissions granted to channel creators and any users promoted to Channel Administrator.'
                            isDisabled={this.props.isDisabled}
                        >
                            <PermissionsTree
                                parentRole={roles?.all_users}
                                role={roles?.channel_admin}
                                scope={'channel_scope'}
                                onToggle={this.togglePermission}
                                selectRow={this.selectRow}
                                readOnly={this.props.isDisabled}
                            />
                        </AdminPanelTogglable>

                        <AdminPanelTogglable
                            className='permissions-block'
                            open={this.state.openRoles.playbook_admin}
                            onToggle={() => this.toggleRole('playbook_admin')}
                            titleId={t('admin.permissions.systemScheme.playbookAdmin')}
                            titleDefault='Playbook Administrator'
                            subtitleId={t('admin.permissions.systemScheme.playbookAdminSubtitle')}
                            subtitleDefault='Permissions granted to administrators of a playbook.'
                            isDisabled={this.props.isDisabled}
                        >
                            <PermissionsTreePlaybooks
                                parentRole={roles?.all_users}
                                role={roles?.playbook_admin}
                                scope={'playbook_scope'}
                                onToggle={this.togglePermission}
                                selectRow={this.selectRow}
                                readOnly={this.props.isDisabled}
                                license={this.props.license}
                            />
                        </AdminPanelTogglable>

                        <AdminPanelTogglable
                            className='permissions-block team_admin'
                            open={this.state.openRoles.team_admin}
                            onToggle={() => this.toggleRole('team_admin')}
                            titleId={t('admin.permissions.systemScheme.teamAdminsTitle')}
                            titleDefault='Team Administrators'
                            subtitleId={t('admin.permissions.systemScheme.teamAdminsDescription')}
                            subtitleDefault='Permissions granted to team creators and any users promoted to Team Administrator.'
                            isDisabled={this.props.isDisabled}
                        >
                            <PermissionsTree
                                parentRole={roles?.all_users}
                                role={roles?.team_admin}
                                scope={'team_scope'}
                                onToggle={this.togglePermission}
                                selectRow={this.selectRow}
                                readOnly={this.props.isDisabled}
                            />
                        </AdminPanelTogglable>
                    </div>
                </div>

                <div className='admin-console-save'>
                    <SaveButton
                        saving={this.state.saving}
                        disabled={this.props.isDisabled || !this.state.saveNeeded}
                        onClick={this.handleSubmit}
                        savingMessage={localizeMessage('admin.saving', 'Saving Config...')}
                    />
                    <BlockableLink
                        className='cancel-button'
                        to='/admin_console/user_management/permissions'
                    >
                        <FormattedMessage
                            id='admin.permissions.permissionSchemes.cancel'
                            defaultMessage='Cancel'
                        />
                    </BlockableLink>
                    <div className='error-message'>
                        <FormError error={this.state.serverError}/>
                    </div>
                </div>
            </div>
        );
    };
}
