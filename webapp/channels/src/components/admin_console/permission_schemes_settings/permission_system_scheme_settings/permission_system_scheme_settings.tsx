// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {ClientConfig, ClientLicense} from '@mattermost/types/config';
import type {Role} from '@mattermost/types/roles';

import GeneralConstants from 'mattermost-redux/constants/general';
import type {ActionResult} from 'mattermost-redux/types/actions';

import BlockableLink from 'components/admin_console/blockable_link';
import ConfirmModal from 'components/confirm_modal';
import ExternalLink from 'components/external_link';
import FormError from 'components/form_error';
import LoadingScreen from 'components/loading_screen';
import SaveButton from 'components/save_button';
import AdminHeader from 'components/widgets/admin_console/admin_header';
import AdminPanelTogglable from 'components/widgets/admin_console/admin_panel_togglable';

import {PermissionsScope, DefaultRolePermissions, DocLinks} from 'utils/constants';
import {t} from 'utils/i18n';
import {localizeMessage} from 'utils/utils';

import GuestPermissionsTree, {GUEST_INCLUDED_PERMISSIONS} from '../guest_permissions_tree';
import PermissionsTree, {EXCLUDED_PERMISSIONS} from '../permissions_tree';
import PermissionsTreePlaybooks from '../permissions_tree_playbooks';

type Props = {
    config: Partial<ClientConfig>;
    roles: Record<string, Role>;
    license: ClientLicense;
    isDisabled?: boolean;
    actions: {
        loadRolesIfNeeded: (roles: Iterable<string>) => void;
        editRole: (role: Partial<Role>) => Promise<ActionResult>;
        setNavigationBlocked: (blocked: boolean) => void;
    };
    location: Location;
}

type State = {
    showResetDefaultModal: boolean;
    loaded: boolean;
    saving: boolean;
    saveNeeded: boolean;
    serverError: null;
    roles: Record<string, Partial<Role>>;
    selectedPermission?: string;
    openRoles: Record<string, boolean>;
    urlParams: URLSearchParams;
}

export default class PermissionSystemSchemeSettings extends React.PureComponent<Props, State> {
    private rolesNeeded: string[];

    constructor(props: Props) {
        super(props);
        this.state = {
            showResetDefaultModal: false,
            loaded: false,
            saving: false,
            saveNeeded: false,
            serverError: null,
            roles: {},
            openRoles: {
                guests: true,
                all_users: true,
                system_admin: true,
                team_admin: true,
                channel_admin: true,
                playbook_member: true,
                playbook_admin: true,
                run_member: true,
                run_admin: true,
            },
            urlParams: new URLSearchParams(props.location.search),
        };
        this.rolesNeeded = [
            GeneralConstants.SYSTEM_ADMIN_ROLE,
            GeneralConstants.SYSTEM_USER_ROLE,
            GeneralConstants.TEAM_ADMIN_ROLE,
            GeneralConstants.TEAM_USER_ROLE,
            GeneralConstants.CHANNEL_ADMIN_ROLE,
            GeneralConstants.CHANNEL_USER_ROLE,
            GeneralConstants.PLAYBOOK_ADMIN_ROLE,
            GeneralConstants.PLAYBOOK_MEMBER_ROLE,
            GeneralConstants.RUN_ADMIN_ROLE,
            GeneralConstants.RUN_MEMBER_ROLE,
            GeneralConstants.SYSTEM_GUEST_ROLE,
            GeneralConstants.TEAM_GUEST_ROLE,
            GeneralConstants.CHANNEL_GUEST_ROLE,
        ];
    }

    componentDidMount() {
        this.props.actions.loadRolesIfNeeded(this.rolesNeeded);
        if (this.rolesNeeded.every((roleName) => this.props.roles[roleName])) {
            this.loadRolesIntoState(this.props);
        }

        if (this.state.urlParams.get('rowIdFromQuery')) {
            setTimeout(() => {
                this.selectRow(this.state.urlParams.get('rowIdFromQuery')!);
            }, 1000);
        }
    }

    UNSAFE_componentWillReceiveProps(nextProps: Props) {
        if (!this.state.loaded && this.rolesNeeded.every((roleName) => nextProps.roles[roleName])) {
            this.loadRolesIntoState(nextProps);
        }
    }

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

    loadRolesIntoState(props: Props) {
        this.setState({
            loaded: true,
            roles: {
                system_admin: props.roles.system_admin,
                team_admin: props.roles.team_admin,
                channel_admin: props.roles.channel_admin,
                playbook_admin: props.roles.playbook_admin,
                playbook_member: props.roles.playbook_member,
                run_admin: props.roles.run_admin,
                run_member: props.roles.run_member,
                all_users: {
                    name: 'all_users',
                    display_name: 'All members',
                    permissions: props.roles.system_user.permissions?.
                        concat(props.roles.team_user.permissions).
                        concat(props.roles.channel_user.permissions).
                        concat(props.roles.playbook_member.permissions).
                        concat(props.roles.run_member.permissions),
                },
                guests: {
                    name: 'guests',
                    display_name: 'Guests',
                    permissions: props.roles.system_guest.permissions?.
                        concat(props.roles.team_guest.permissions).
                        concat(props.roles.channel_guest.permissions),
                },
            },
        });
    }

    deriveRolesFromAllUsers = (role: Partial<Role>): Record<string, Partial<Role>> => {
        return {
            system_user: {
                ...this.props.roles.system_user,
                permissions: role.permissions?.filter((p) => PermissionsScope[p] === 'system_scope'),
            },
            team_user: {
                ...this.props.roles.team_user,
                permissions: role.permissions?.filter((p) => PermissionsScope[p] === 'team_scope'),
            },
            channel_user: {
                ...this.props.roles.channel_user,
                permissions: role.permissions?.filter((p) => PermissionsScope[p] === 'channel_scope'),
            },
            playbook_member: {
                ...this.props.roles.playbook_member,
                permissions: role.permissions?.filter((p) => PermissionsScope[p] === 'playbook_scope'),
            },
            run_member: {
                ...this.props.roles.run_member,
                permissions: role.permissions?.filter((p) => PermissionsScope[p] === 'run_scope'),
            },
        };
    };

    deriveRolesFromGuests = (role: Partial<Role>): Record<string, Partial<Role>> => {
        return {
            system_guest: {
                ...this.props.roles.system_guest,
                permissions: role.permissions?.filter((p) => PermissionsScope[p] === 'system_scope'),
            },
            team_guest: {
                ...this.props.roles.team_guest,
                permissions: role.permissions?.filter((p) => PermissionsScope[p] === 'team_scope'),
            },
            channel_guest: {
                ...this.props.roles.channel_guest,
                permissions: role.permissions?.filter((p) => PermissionsScope[p] === 'channel_scope'),
            },
        };
    };

    restoreExcludedPermissions = (roles: Record<string, Partial<Role>>) => {
        for (const permission of this.props.roles.system_user.permissions) {
            if (EXCLUDED_PERMISSIONS.includes(permission)) {
                roles.system_user.permissions?.push(permission);
            }
        }
        for (const permission of this.props.roles.team_user.permissions) {
            if (EXCLUDED_PERMISSIONS.includes(permission)) {
                roles.team_user.permissions?.push(permission);
            }
        }
        for (const permission of this.props.roles.channel_user.permissions) {
            if (EXCLUDED_PERMISSIONS.includes(permission)) {
                roles.channel_user.permissions?.push(permission);
            }
        }
        for (const permission of this.props.roles.playbook_member.permissions) {
            if (EXCLUDED_PERMISSIONS.includes(permission)) {
                roles.playbook_member.permissions?.push(permission);
            }
        }
        return roles;
    };

    restoreGuestPermissions = (roles: Record<string, Partial<Role>>) => {
        for (const permission of this.props.roles.system_guest.permissions) {
            if (!GUEST_INCLUDED_PERMISSIONS.includes(permission)) {
                roles.system_guest.permissions?.push(permission);
            }
        }
        for (const permission of this.props.roles.team_guest.permissions) {
            if (!GUEST_INCLUDED_PERMISSIONS.includes(permission)) {
                roles.team_guest.permissions?.push(permission);
            }
        }
        for (const permission of this.props.roles.channel_guest.permissions) {
            if (!GUEST_INCLUDED_PERMISSIONS.includes(permission)) {
                roles.channel_guest.permissions?.push(permission);
            }
        }
        return roles;
    };

    handleSubmit = async () => {
        const teamAdminPromise = this.props.actions.editRole(this.state.roles.team_admin);
        const channelAdminPromise = this.props.actions.editRole(this.state.roles.channel_admin);
        const playbookAdminPromise = this.props.actions.editRole(this.state.roles.playbook_admin);

        const derivedRoles = this.restoreExcludedPermissions(this.deriveRolesFromAllUsers(this.state.roles.all_users));
        const systemUserPromise = this.props.actions.editRole(derivedRoles.system_user);
        const teamUserPromise = this.props.actions.editRole(derivedRoles.team_user);
        const channelUserPromise = this.props.actions.editRole(derivedRoles.channel_user);
        const playbookMemberPromise = this.props.actions.editRole(derivedRoles.playbook_member);
        const runMemberPromise = this.props.actions.editRole(derivedRoles.run_member);

        const promises = [
            teamAdminPromise,
            channelAdminPromise,
            systemUserPromise,
            teamUserPromise,
            channelUserPromise,
            playbookAdminPromise,
            playbookMemberPromise,
            runMemberPromise,
        ];

        if (this.haveGuestAccountsPermissions()) {
            const guestRoles = this.restoreGuestPermissions(this.deriveRolesFromGuests(this.state.roles.guests));
            const systemGuestPromise = this.props.actions.editRole(guestRoles.system_guest);
            const teamGuestPromise = this.props.actions.editRole(guestRoles.team_guest);
            const channelGuestPromise = this.props.actions.editRole(guestRoles.channel_guest);
            promises.push(systemGuestPromise, teamGuestPromise, channelGuestPromise);
        }

        this.setState({saving: true});

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
    };

    toggleRole = (roleId: string) => {
        const newOpenRoles = {...this.state.openRoles};
        newOpenRoles[roleId] = !newOpenRoles[roleId];
        this.setState({openRoles: newOpenRoles});
    };

    togglePermission = (roleId: string, permissions: Iterable<string>) => {
        const roles = {...this.state.roles};
        const role = {...roles[roleId]};
        const newPermissions = [...role.permissions!];
        for (const permission of permissions) {
            if (newPermissions.indexOf(permission) === -1) {
                newPermissions.push(permission);
            } else {
                newPermissions.splice(newPermissions.indexOf(permission), 1);
            }
        }
        role.permissions = newPermissions;
        roles[roleId] = role;

        this.setState({roles, saveNeeded: true});
        this.props.actions.setNavigationBlocked(true);
    };

    resetDefaults = () => {
        const newRolesState = JSON.parse(JSON.stringify({...this.state.roles}));

        Object.entries(DefaultRolePermissions).forEach(([roleName, permissions]) => {
            newRolesState[roleName].permissions = permissions;
        });

        this.setState({roles: newRolesState, saveNeeded: true});
        this.props.actions.setNavigationBlocked(true);
    };

    haveGuestAccountsPermissions = () => {
        return this.props.license.GuestAccountsPermissions === 'true';
    };

    render = () => {
        if (!this.state.loaded) {
            return <LoadingScreen/>;
        }
        const isLicensed = this.props.license?.IsLicensed === 'true';
        return (
            <div className='wrapper--fixed'>
                <AdminHeader withBackButton={true}>
                    <div>
                        <BlockableLink
                            to='/admin_console/user_management/permissions'
                            className='fa fa-angle-left back'
                        />
                        <FormattedMessage
                            id='admin.permissions.systemScheme'
                            defaultMessage='System Scheme'
                        />
                    </div>
                </AdminHeader>

                <div className='admin-console__wrapper'>
                    <div className='admin-console__content'>
                        <div className={'banner info'}>
                            <div className='banner__content'>
                                <span>
                                    <FormattedMessage
                                        id='admin.permissions.systemScheme.introBanner'
                                        defaultMessage='Configure the default permissions for Team Admins, Channel Admins and other members. This scheme is inherited by all teams unless a <link>Team Override Scheme</link>is applied in specific teams.'
                                        values={{
                                            link: (msg: React.ReactNode) => (
                                                <ExternalLink
                                                    href={DocLinks.ONBOARD_ADVANCED_PERMISSIONS}
                                                    location='permission_system_scheme_settings'
                                                >
                                                    {msg}
                                                </ExternalLink>
                                            ),
                                        }}
                                    />
                                </span>
                            </div>
                        </div>

                        {isLicensed && this.props.config.EnableGuestAccounts === 'true' &&
                            <AdminPanelTogglable
                                className='permissions-block'
                                open={this.state.openRoles.guests}
                                id='all_users'
                                onToggle={() => this.toggleRole('guests')}
                                titleId={t('admin.permissions.systemScheme.GuestsTitle')}
                                titleDefault='Guests'
                                subtitleId={t('admin.permissions.systemScheme.GuestsDescription')}
                                subtitleDefault='Permissions granted to guest users.'
                            >
                                <GuestPermissionsTree
                                    selected={this.state.selectedPermission}
                                    role={this.state.roles.guests}
                                    scope={'system_scope'}
                                    onToggle={this.togglePermission}
                                    selectRow={this.selectRow}
                                    readOnly={this.props.isDisabled || !this.haveGuestAccountsPermissions()}
                                />
                            </AdminPanelTogglable>}

                        <AdminPanelTogglable
                            className='permissions-block'
                            open={this.state.openRoles.all_users}
                            id='all_users'
                            onToggle={() => this.toggleRole('all_users')}
                            titleId={t('admin.permissions.systemScheme.allMembersTitle')}
                            titleDefault='All Members'
                            subtitleId={t('admin.permissions.systemScheme.allMembersDescription')}
                            subtitleDefault='Permissions granted to all members, including administrators and newly created users.'
                        >
                            <PermissionsTree
                                selected={this.state.selectedPermission}
                                role={this.state.roles.all_users}
                                scope={'system_scope'}
                                onToggle={this.togglePermission}
                                selectRow={this.selectRow}
                                readOnly={this.props.isDisabled}
                            />
                        </AdminPanelTogglable>

                        <AdminPanelTogglable
                            className='permissions-block'
                            open={this.state.openRoles.channel_admin}
                            onToggle={() => this.toggleRole('channel_admin')}
                            titleId={t('admin.permissions.systemScheme.channelAdminsTitle')}
                            titleDefault='Channel Administrators'
                            subtitleId={t('admin.permissions.systemScheme.channelAdminsDescription')}
                            subtitleDefault='Permissions granted to channel creators and any users promoted to Channel Administrator.'
                        >
                            <PermissionsTree
                                parentRole={this.state.roles.all_users}
                                role={this.state.roles.channel_admin}
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
                        >
                            <PermissionsTreePlaybooks
                                role={this.state.roles.playbook_admin}
                                parentRole={this.state.roles.all_users}
                                scope={'playbook_scope'}
                                onToggle={this.togglePermission}
                                selectRow={this.selectRow}
                                readOnly={this.props.isDisabled || false}
                                license={this.props.license}
                            />
                        </AdminPanelTogglable>

                        <AdminPanelTogglable
                            className='permissions-block'
                            open={this.state.openRoles.team_admin}
                            onToggle={() => this.toggleRole('team_admin')}
                            titleId={t('admin.permissions.systemScheme.teamAdminsTitle')}
                            titleDefault='Team Administrators'
                            subtitleId={t('admin.permissions.systemScheme.teamAdminsDescription')}
                            subtitleDefault='Permissions granted to team creators and any users promoted to Team Administrator.'
                        >
                            <PermissionsTree
                                parentRole={this.state.roles.all_users}
                                role={this.state.roles.team_admin}
                                scope={'team_scope'}
                                onToggle={this.togglePermission}
                                selectRow={this.selectRow}
                                readOnly={this.props.isDisabled}
                            />
                        </AdminPanelTogglable>

                        <AdminPanelTogglable
                            className='permissions-block'
                            open={this.state.openRoles.system_admin}
                            onToggle={() => this.toggleRole('system_admin')}
                            titleId={t('admin.permissions.systemScheme.systemAdminsTitle')}
                            titleDefault='System Administrators'
                            subtitleId={t('admin.permissions.systemScheme.systemAdminsDescription')}
                            subtitleDefault='Full permissions granted to System Administrators.'
                        >
                            <PermissionsTree
                                readOnly={true}
                                role={this.state.roles.system_admin}
                                scope={'system_scope'}
                                onToggle={this.togglePermission}
                                selectRow={this.selectRow}
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
                        className='btn btn-tertiary'
                        to='/admin_console/user_management/permissions'
                    >
                        <FormattedMessage
                            id='admin.permissions.permissionSchemes.cancel'
                            defaultMessage='Cancel'
                        />
                    </BlockableLink>
                    <a
                        data-testid='resetPermissionsToDefault'
                        onClick={() => this.setState({showResetDefaultModal: true})}
                        className='btn btn-quaternary'
                    >
                        <FormattedMessage
                            id='admin.permissions.systemScheme.resetDefaultsButton'
                            defaultMessage='Reset to Defaults'
                        />
                    </a>
                    <div className='error-message'>
                        <FormError error={this.state.serverError}/>
                    </div>
                </div>

                <ConfirmModal
                    show={this.state.showResetDefaultModal}
                    title={
                        <FormattedMessage
                            id='admin.permissions.systemScheme.resetDefaultsButtonModalTitle'
                            defaultMessage='Reset to Default?'
                        />
                    }
                    message={
                        <FormattedMessage
                            id='admin.permissions.systemScheme.resetDefaultsButtonModalBody'
                            defaultMessage='This will reset all selections on this page to their default settings. Are you sure you want to reset?'
                        />
                    }
                    confirmButtonText={
                        <FormattedMessage
                            id='admin.permissions.systemScheme.resetDefaultsConfirmationButton'
                            defaultMessage='Yes, Reset'
                        />
                    }
                    onConfirm={() => {
                        this.resetDefaults();
                        this.setState({showResetDefaultModal: false});
                    }}
                    onCancel={() => this.setState({showResetDefaultModal: false})}
                />
            </div>
        );
    };
}
