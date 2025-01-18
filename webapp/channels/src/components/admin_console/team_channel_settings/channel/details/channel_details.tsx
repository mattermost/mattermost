// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import cloneDeep from 'lodash/cloneDeep';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {Channel, ChannelModeration as ChannelPermissions, ChannelModerationPatch} from '@mattermost/types/channels';
import {SyncableType} from '@mattermost/types/groups';
import type {SyncablePatch, Group} from '@mattermost/types/groups';
import type {Scheme} from '@mattermost/types/schemes';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {Permissions} from 'mattermost-redux/constants';
import type {ActionResult} from 'mattermost-redux/types/actions';

import {trackEvent} from 'actions/telemetry_actions.jsx';

import BlockableLink from 'components/admin_console/blockable_link';
import ConfirmModal from 'components/confirm_modal';
import FormError from 'components/form_error';
import AdminHeader from 'components/widgets/admin_console/admin_header';

import {getHistory} from 'utils/browser_history';
import Constants from 'utils/constants';

import {ChannelGroups} from './channel_groups';
import ChannelMembers from './channel_members';
import ChannelModeration from './channel_moderation';
import {ChannelModes} from './channel_modes';
import {ChannelProfile} from './channel_profile';
import type {ChannelModerationRoles} from './types';

import SaveChangesPanel from '../../../save_changes_panel';
import ConvertAndRemoveConfirmModal from '../../convert_and_remove_confirm_modal';
import ConvertConfirmModal from '../../convert_confirm_modal';
import {NeedGroupsError, UsersWillBeRemovedError} from '../../errors';
import RemoveConfirmModal from '../../remove_confirm_modal';

export interface ChannelDetailsProps {
    channelID: string;
    channel?: Channel;
    team?: Team;
    groups: Group[];
    totalGroups: number;
    allGroups: Record<string, Group>;
    channelPermissions: ChannelPermissions[];
    teamScheme?: Scheme;
    guestAccountsEnabled: boolean;
    channelModerationEnabled: boolean;
    channelGroupsEnabled: boolean;
    isDisabled?: boolean;
    actions: ChannelDetailsActions;
}

interface ChannelDetailsState {
    isSynced: boolean;
    isPublic: boolean;
    isDefault: boolean;
    totalGroups: number;
    groups: Group[];
    usersToRemoveCount: number;
    usersToRemove: Record<string, UserProfile>;
    usersToAdd: Record<string, UserProfile>;
    rolesToUpdate: {
        [userId: string]: {
            schemeUser: boolean;
            schemeAdmin: boolean;
        };
    };
    saveNeeded: boolean;
    serverError: JSX.Element | undefined;
    previousServerError: JSX.Element | undefined;
    isPrivacyChanging: boolean;
    saving: boolean;
    showConvertConfirmModal: boolean;
    showRemoveConfirmModal: boolean;
    showConvertAndRemoveConfirmModal: boolean;
    channelPermissions: ChannelPermissions[];
    teamScheme?: Scheme;
    isLocalArchived: boolean;
    showArchiveConfirmModal: boolean;
}

export type ChannelDetailsActions = {
    getGroups: (channelID: string, q?: string, page?: number, perPage?: number, filterAllowReference?: boolean) => Promise<ActionResult>;
    linkGroupSyncable: (groupID: string, syncableID: string, syncableType: SyncableType, patch: SyncablePatch) => Promise<ActionResult>;
    unlinkGroupSyncable: (groupID: string, syncableID: string, syncableType: SyncableType) => Promise<ActionResult>;
    membersMinusGroupMembers: (channelID: string, groupIDs: string[], page?: number, perPage?: number) => Promise<ActionResult>;
    setNavigationBlocked: (blocked: boolean) => {type: 'SET_NAVIGATION_BLOCKED'; blocked: boolean};
    getChannel: (channelId: string) => void;
    getTeam: (teamId: string) => Promise<ActionResult>;
    getChannelModerations: (channelId: string) => Promise<ActionResult>;
    patchChannel: (channelId: string, patch: Channel) => Promise<ActionResult>;
    updateChannelPrivacy: (channelId: string, privacy: string) => Promise<ActionResult>;
    patchGroupSyncable: (groupID: string, syncableID: string, syncableType: SyncableType, patch: Partial<SyncablePatch>) => Promise<ActionResult>;
    patchChannelModerations: (channelID: string, patch: ChannelModerationPatch[]) => Promise<ActionResult>;
    loadScheme: (schemeID: string) => Promise<ActionResult>;
    addChannelMember: (channelId: string, userId: string, postRootId?: string) => Promise<ActionResult>;
    removeChannelMember: (channelId: string, userId: string) => Promise<ActionResult>;
    updateChannelMemberSchemeRoles: (channelId: string, userId: string, isSchemeUser: boolean, isSchemeAdmin: boolean) => Promise<ActionResult>;
    deleteChannel: (channelId: string) => Promise<ActionResult>;
    unarchiveChannel: (channelId: string) => Promise<ActionResult>;
};

export default class ChannelDetails extends React.PureComponent<ChannelDetailsProps, ChannelDetailsState> {
    constructor(props: ChannelDetailsProps) {
        super(props);
        this.state = {
            isSynced: Boolean(props.channel?.group_constrained),
            isPublic: props.channel?.type === Constants.OPEN_CHANNEL,
            isDefault: props.channel?.name === Constants.DEFAULT_CHANNEL,
            isPrivacyChanging: false,
            saving: false,
            totalGroups: props.totalGroups,
            showConvertConfirmModal: false,
            showRemoveConfirmModal: false,
            showConvertAndRemoveConfirmModal: false,
            usersToRemoveCount: 0,
            usersToRemove: {},
            usersToAdd: {},
            rolesToUpdate: {},
            groups: props.groups,
            saveNeeded: false,
            serverError: undefined,
            previousServerError: undefined,
            channelPermissions: props.channelPermissions,
            teamScheme: props.teamScheme,
            isLocalArchived: props.channel?.delete_at !== 0,
            showArchiveConfirmModal: false,
        };
    }

    componentDidUpdate(prevProps: ChannelDetailsProps) {
        const {channel, totalGroups, actions} = this.props;
        if (channel?.id !== prevProps.channel?.id || totalGroups !== prevProps.totalGroups) {
            this.setState({
                totalGroups,
                isSynced: Boolean(channel?.group_constrained),
                isPublic: channel?.type === Constants.OPEN_CHANNEL,
                isDefault: channel?.name === Constants.DEFAULT_CHANNEL,
                isLocalArchived: channel?.delete_at !== 0,
            });
        }

        // If we don't have the team and channel on mount, we need to request the team after we load the channel
        if (!prevProps.team?.id && !prevProps.channel?.team_id && channel?.team_id) {
            actions.getTeam(channel.team_id).
                then(async (data: any) => {
                    if (data.data && data.data.scheme_id) {
                        await actions.loadScheme(data.data.scheme_id);
                    }
                }).
                then(() => this.setState({teamScheme: this.props.teamScheme}));
        }
    }

    componentDidMount() {
        const {channelID, channel, actions} = this.props;
        if (channelID) {
            if (this.props.channelModerationEnabled) {
                actions.getGroups(channelID).
                    then(() => this.setState({groups: this.props.groups}));
                actions.getChannelModerations(channelID).then(() => this.restrictChannelMentions());
            }
            actions.getChannel(channelID);
        }

        if (channel?.team_id) {
            actions.getTeam(channel.team_id).
                then(async (data: any) => {
                    if (data.data && data.data.scheme_id) {
                        await actions.loadScheme(data.data.scheme_id);
                    }
                }).
                then(() => this.setState({teamScheme: this.props.teamScheme}));
        }
    }

    private restrictChannelMentions() {
        // Disabling use_channel_mentions on every role that create_post is either disabled or has a value of false
        let channelPermissions = this.props.channelPermissions;
        const currentCreatePostRoles: any = channelPermissions.find((element) => element.name === Permissions.CHANNEL_MODERATED_PERMISSIONS.CREATE_POST)?.roles;
        if (currentCreatePostRoles) {
            for (const channelRole of Object.keys(currentCreatePostRoles)) {
                channelPermissions = channelPermissions.map((permission) => {
                    if (permission.name === Permissions.CHANNEL_MODERATED_PERMISSIONS.USE_CHANNEL_MENTIONS && (!currentCreatePostRoles[channelRole].value || !currentCreatePostRoles[channelRole].enabled)) {
                        return {
                            name: permission.name,
                            roles: {
                                ...permission.roles,
                                [channelRole]: {
                                    value: false,
                                    enabled: false,
                                },
                            },
                        };
                    }
                    return permission;
                });
            }
        }
        this.setState({channelPermissions});
    }

    private setToggles = (isSynced: boolean, isPublic: boolean) => {
        const {channel} = this.props;
        const isOriginallyPublic = channel?.type === Constants.OPEN_CHANNEL;
        this.setState(
            {
                saveNeeded: true,
                isSynced,
                isPublic,
                isPrivacyChanging: isPublic !== isOriginallyPublic,
            },
            () => this.processGroupsChange(this.state.groups),
        );
        this.props.actions.setNavigationBlocked(true);
    };

    async processGroupsChange(groups: Group[]) {
        const {actions, channelID} = this.props;
        actions.setNavigationBlocked(true);
        let serverError: JSX.Element | undefined;
        let usersToRemoveCount = 0;
        if (this.state.isSynced) {
            try {
                if (groups.length === 0) {
                    serverError = (
                        <NeedGroupsError
                            warning={true}
                            isChannel={true}
                        />
                    );
                } else {
                    if (!channelID) {
                        return;
                    }

                    const result = await actions.membersMinusGroupMembers(channelID, groups.map((g) => g.id));
                    if ('data' in result) {
                        usersToRemoveCount = result.data.total_count;
                        if (usersToRemoveCount > 0) {
                            serverError = (
                                <UsersWillBeRemovedError
                                    total={usersToRemoveCount}
                                    users={result.data.users}
                                    scope='channel'
                                    scopeId={this.props.channelID}
                                />
                            );
                        }
                    }
                }
            } catch (ex) {
                serverError = ex;
            }
        }
        this.setState({groups, usersToRemoveCount, saveNeeded: true, serverError});
    }

    private handleGroupRemoved = (gid: string) => {
        const groups = this.state.groups.filter((g) => g.id !== gid);
        this.setState({totalGroups: this.state.totalGroups - 1});
        this.processGroupsChange(groups);
    };

    private setNewGroupRole = (gid: string) => {
        const groups = cloneDeep(this.state.groups).map((g) => {
            if (g.id === gid) {
                g.scheme_admin = !g.scheme_admin;
            }
            return g;
        });
        this.processGroupsChange(groups);
    };

    private channelPermissionsChanged = (name: string, channelRole: ChannelModerationRoles) => {
        const currentValueIndex = this.state.channelPermissions.findIndex((element) => element.name === name);
        const currentValue = this.state.channelPermissions[currentValueIndex].roles[channelRole]!.value;
        const newValue = !currentValue;
        let channelPermissions = [...this.state.channelPermissions];

        if (name === Permissions.CHANNEL_MODERATED_PERMISSIONS.CREATE_POST) {
            const originalObj = this.props.channelPermissions.find((element) => element.name === Permissions.CHANNEL_MODERATED_PERMISSIONS.USE_CHANNEL_MENTIONS)?.roles![channelRole];
            channelPermissions = channelPermissions.map((permission) => {
                if (permission.name === Permissions.CHANNEL_MODERATED_PERMISSIONS.USE_CHANNEL_MENTIONS && !newValue) {
                    return {
                        name: permission.name,
                        roles: {
                            ...permission.roles,
                            [channelRole]: {
                                value: false,
                                enabled: false,
                            },
                        },
                    };
                } else if (permission.name === Permissions.CHANNEL_MODERATED_PERMISSIONS.USE_CHANNEL_MENTIONS) {
                    return {
                        name: permission.name,
                        roles: {
                            ...permission.roles,
                            [channelRole]: {
                                value: originalObj?.value,
                                enabled: originalObj?.enabled,
                            },
                        },
                    };
                }
                return permission;
            });
        }
        channelPermissions[currentValueIndex] = {
            ...channelPermissions[currentValueIndex],
            roles: {
                ...channelPermissions[currentValueIndex].roles,
                [channelRole]: {
                    ...channelPermissions[currentValueIndex].roles[channelRole],
                    value: newValue,
                },
            },
        };
        this.setState({channelPermissions, saveNeeded: true});
        this.props.actions.setNavigationBlocked(true);
    };

    private handleGroupChange = (groupIDs: string[]) => {
        const groups = [...this.state.groups, ...groupIDs.map((gid: string) => this.props.allGroups[gid])];
        this.setState({totalGroups: this.state.totalGroups + groupIDs.length});
        this.processGroupsChange(groups);
    };

    private hideConvertConfirmModal = () => {
        this.setState({showConvertConfirmModal: false});
    };

    private hideRemoveConfirmModal = () => {
        this.setState({showRemoveConfirmModal: false});
    };

    private hideConvertAndRemoveConfirmModal = () => {
        this.setState({showConvertAndRemoveConfirmModal: false});
    };

    private hideArchiveConfirmModal = () => {
        this.setState({showArchiveConfirmModal: false});
    };

    private onSave = () => {
        const {channel} = this.props;
        const {isSynced, usersToRemoveCount, serverError} = this.state;
        let {isPublic, isPrivacyChanging} = this.state;
        if (this.channelToBeArchived()) {
            this.setState({showArchiveConfirmModal: true});
            return;
        }
        const isOriginallyPublic = channel?.type === Constants.OPEN_CHANNEL;
        if (isSynced) {
            isPublic = false;
            isPrivacyChanging = isOriginallyPublic;
            this.setState({
                isPublic,
                isPrivacyChanging,
            });
        }
        if (isPrivacyChanging && usersToRemoveCount > 0) {
            this.setState({showConvertAndRemoveConfirmModal: true});
            return;
        }
        if (isPrivacyChanging && usersToRemoveCount === 0 && !serverError) {
            this.setState({showConvertConfirmModal: true});
            return;
        }
        if (!isPrivacyChanging && usersToRemoveCount > 0) {
            this.setState({showRemoveConfirmModal: true});
            return;
        }
        this.handleSubmit();
    };

    private handleSubmit = async () => {
        const {groups: origGroups, channelID, actions, channel} = this.props;

        if (!channel) {
            return;
        }

        this.setState({showConvertConfirmModal: false, showRemoveConfirmModal: false, showConvertAndRemoveConfirmModal: false, showArchiveConfirmModal: false, saving: true});
        const {groups, isSynced, isPublic, isPrivacyChanging, channelPermissions, usersToAdd, usersToRemove, rolesToUpdate} = this.state;
        let serverError: JSX.Element | undefined;
        let saveNeeded = false;

        if (this.channelToBeArchived()) {
            const result = await actions.deleteChannel(channel.id);
            if ('error' in result) {
                serverError = <FormError error={result.error.message}/>;
                saveNeeded = true;
            } else {
                trackEvent('admin_channel_config_page', 'channel_archived', {channel_id: channelID});
            }
            this.setState({serverError, saving: false, saveNeeded, isPrivacyChanging: false, usersToRemoveCount: 0, rolesToUpdate: {}, usersToAdd: {}, usersToRemove: {}}, () => {
                actions.setNavigationBlocked(saveNeeded);
                if (!saveNeeded) {
                    getHistory().push('/admin_console/user_management/channels');
                }
            });
            return;
        } else if (this.channelToBeRestored() && !this.state.serverError) {
            const result = await actions.unarchiveChannel(channel.id);
            if ('error' in result) {
                serverError = <FormError error={result.error.message}/>;
            } else {
                trackEvent('admin_channel_config_page', 'channel_unarchived', {channel_id: channelID});
            }
            this.setState({serverError, previousServerError: undefined});
        }

        if (this.state.groups.length === 0 && isSynced) {
            serverError = <NeedGroupsError isChannel={true}/>;
            saveNeeded = true;
            this.setState({serverError, saving: false, saveNeeded});
            actions.setNavigationBlocked(saveNeeded);
            return;
        }

        const promises = [];
        if (isPrivacyChanging) {
            const convert = actions.updateChannelPrivacy(channel.id, isPublic ? Constants.OPEN_CHANNEL : Constants.PRIVATE_CHANNEL);
            promises.push(
                convert.then((res: ActionResult) => {
                    if ('error' in res) {
                        return res;
                    }
                    return actions.patchChannel(channel.id, {
                        ...channel,
                        group_constrained: isSynced,
                    });
                }),
            );
        } else {
            promises.push(
                actions.patchChannel(channel.id, {
                    ...channel,
                    group_constrained: isSynced,
                }),
            );
        }

        const patchChannelSyncable = groups.
            filter((g) => {
                return origGroups.some((group) => group.id === g.id && group.scheme_admin !== g.scheme_admin);
            }).
            map((g) => actions.patchGroupSyncable(g.id, channelID, SyncableType.Channel, {scheme_admin: g.scheme_admin}));

        const unlink = origGroups.
            filter((g) => {
                return !groups.some((group) => group.id === g.id);
            }).
            map((g) => actions.unlinkGroupSyncable(g.id, channelID, SyncableType.Channel));

        const link = groups.
            filter((g) => {
                return !origGroups.some((group) => group.id === g.id);
            }).
            map((g) => actions.linkGroupSyncable(g.id, channelID, SyncableType.Channel, {auto_add: true, scheme_admin: g.scheme_admin}));

        const groupActions = [...promises, ...patchChannelSyncable, ...unlink, ...link];
        if (groupActions.length > 0) {
            const result = await Promise.all(groupActions);
            const resultWithError = result.find((r) => 'error' in r);
            if (resultWithError && 'error' in resultWithError) {
                serverError = <FormError error={resultWithError.error.message}/>;
            } else {
                if (unlink.length > 0) {
                    trackEvent('admin_channel_config_page', 'groups_removed_from_channel', {count: unlink.length, channel_id: channelID});
                }
                if (link.length > 0) {
                    trackEvent('admin_channel_config_page', 'groups_added_to_channel', {count: link.length, channel_id: channelID});
                }

                const actionsToAwait: any[] = [];
                if (this.props.channelModerationEnabled) {
                    actionsToAwait.push(actions.getGroups(channelID));
                }
                if (isPrivacyChanging) {
                    // If the privacy is changing update the manage_members value for the channel moderation widget
                    if (this.props.channelModerationEnabled) {
                        actionsToAwait.push(
                            actions.getChannelModerations(channelID).then(() => {
                                const manageMembersIndex = channelPermissions.findIndex((element) => element.name === Permissions.CHANNEL_MODERATED_PERMISSIONS.MANAGE_MEMBERS);
                                if (channelPermissions) {
                                    const updatedManageMembers = this.props.channelPermissions.find((element) => element.name === Permissions.CHANNEL_MODERATED_PERMISSIONS.MANAGE_MEMBERS);
                                    channelPermissions[manageMembersIndex] = updatedManageMembers || channelPermissions[manageMembersIndex];
                                }
                                this.setState({channelPermissions});
                            }),
                        );
                    }
                }
                if (actionsToAwait.length > 0) {
                    await Promise.all(actionsToAwait);
                }
                await Promise.resolve();
            }
        }
        if (this.props.channelModerationEnabled) {
            const patchChannelPermissionsArray: ChannelModerationPatch[] = channelPermissions.map((p) => {
                return {
                    name: p.name,
                    roles: {
                        ...(p.roles.members && p.roles.members.enabled && {members: p.roles.members!.value}),
                        ...(p.roles.guests && p.roles.guests.enabled && {guests: p.roles.guests!.value}),
                    },
                };
            });

            const patchChannelModerationsResult = await actions.patchChannelModerations(channelID, patchChannelPermissionsArray);
            if (patchChannelModerationsResult.error) {
                serverError = <FormError error={patchChannelModerationsResult.error.message}/>;
            }
            this.restrictChannelMentions();
        }

        let privacyChanging = isPrivacyChanging;
        if (serverError == null) {
            privacyChanging = false;
        }

        const usersToAddList = Object.values(usersToAdd);
        const usersToRemoveList = Object.values(usersToRemove);
        const userRolesToUpdate = Object.keys(rolesToUpdate);
        const usersToUpdate = usersToAddList.length > 0 || usersToRemoveList.length > 0 || userRolesToUpdate.length > 0;
        if (usersToUpdate && !isSynced) {
            const addUserActions: any[] = [];
            const removeUserActions: any[] = [];
            const {addChannelMember, removeChannelMember, updateChannelMemberSchemeRoles} = this.props.actions;
            usersToAddList.forEach((user) => {
                addUserActions.push(addChannelMember(channelID, user.id));
            });
            usersToRemoveList.forEach((user) => {
                removeUserActions.push(removeChannelMember(channelID, user.id));
            });

            if (addUserActions.length > 0) {
                const result = await Promise.all(addUserActions);
                const resultWithError = result.find((r) => 'error' in r);
                const count = result.filter((r) => 'data' in r).length;
                if (resultWithError && 'error' in resultWithError) {
                    serverError = <FormError error={resultWithError.error.message}/>;
                }
                if (count > 0) {
                    trackEvent('admin_channel_config_page', 'members_added_to_channel', {count, channel_id: channelID});
                }
            }

            if (removeUserActions.length > 0) {
                const result = await Promise.all(removeUserActions);
                const resultWithError = result.find((r) => 'error' in r);
                const count = result.filter((r) => 'data' in r).length;
                if (resultWithError && 'error' in resultWithError) {
                    serverError = <FormError error={resultWithError.error.message}/>;
                }
                if (count > 0) {
                    trackEvent('admin_channel_config_page', 'members_removed_from_channel', {count, channel_id: channelID});
                }
            }

            const rolesToPromote: any[] = [];
            const rolesToDemote: any[] = [];
            userRolesToUpdate.forEach((userId) => {
                const {schemeUser, schemeAdmin} = rolesToUpdate[userId];
                if (schemeAdmin) {
                    rolesToPromote.push(updateChannelMemberSchemeRoles(channelID, userId, schemeUser, schemeAdmin));
                } else {
                    rolesToDemote.push(updateChannelMemberSchemeRoles(channelID, userId, schemeUser, schemeAdmin));
                }
            });

            if (rolesToPromote.length > 0) {
                const result = await Promise.all(rolesToPromote);
                const resultWithError = result.find((r) => 'error' in r);
                const count = result.filter((r) => 'data' in r).length;
                if (resultWithError && 'error' in resultWithError) {
                    serverError = <FormError error={resultWithError.error.message}/>;
                }
                if (count > 0) {
                    trackEvent('admin_channel_config_page', 'members_elevated_to_channel_admin', {count, channel_id: channelID});
                }
            }

            if (rolesToDemote.length > 0) {
                const result = await Promise.all(rolesToDemote);
                const resultWithError = result.find((r) => 'error' in r);
                const count = result.filter((r) => 'data' in r).length;
                if (resultWithError && 'error' in resultWithError) {
                    serverError = <FormError error={resultWithError.error.message}/>;
                }
                if (count > 0) {
                    trackEvent('admin_channel_config_page', 'admins_demoted_to_channel_member', {count, channel_id: channelID});
                }
            }
        }

        this.setState({serverError, saving: false, saveNeeded, isPrivacyChanging: privacyChanging, usersToRemoveCount: 0, rolesToUpdate: {}, usersToAdd: {}, usersToRemove: {}}, () => {
            actions.setNavigationBlocked(saveNeeded);
            if (!saveNeeded && !serverError) {
                getHistory().push('/admin_console/user_management/channels');
            }
        });
    };

    private channelToBeArchived = (): boolean => {
        const {isLocalArchived} = this.state;
        const isServerArchived = this.props.channel?.delete_at !== 0;
        return isLocalArchived && !isServerArchived;
    };

    private channelToBeRestored = (): boolean => {
        const {isLocalArchived} = this.state;
        const isServerArchived = this.props.channel?.delete_at !== 0;
        return !isLocalArchived && isServerArchived;
    };

    private addRolesToUpdate = (userId: string, schemeUser: boolean, schemeAdmin: boolean) => {
        const {rolesToUpdate} = this.state;
        rolesToUpdate[userId] = {schemeUser, schemeAdmin};
        this.setState({rolesToUpdate: {...rolesToUpdate}, saveNeeded: true});
        this.props.actions.setNavigationBlocked(true);
    };

    private addUserToRemove = (user: UserProfile) => {
        let {usersToRemoveCount} = this.state;
        const {usersToAdd, usersToRemove, rolesToUpdate} = this.state;
        if (usersToAdd[user.id]?.id === user.id) {
            delete usersToAdd[user.id];
        } else if (usersToRemove[user.id]?.id !== user.id) {
            usersToRemoveCount += 1;
            usersToRemove[user.id] = user;
        }
        delete rolesToUpdate[user.id];
        this.setState({usersToRemove: {...usersToRemove}, usersToAdd: {...usersToAdd}, rolesToUpdate: {...rolesToUpdate}, usersToRemoveCount, saveNeeded: true});
        this.props.actions.setNavigationBlocked(true);
    };

    private addUsersToAdd = (users: UserProfile[]) => {
        let {usersToRemoveCount} = this.state;
        const usersToRemove = {...this.state.usersToRemove};
        const usersToAdd = {...this.state.usersToAdd};
        users.forEach((user) => {
            if (usersToRemove[user.id]?.id === user.id) {
                delete usersToRemove[user.id];
                usersToRemoveCount -= 1;
            } else {
                usersToAdd[user.id] = user;
            }
        });
        this.setState({usersToAdd: {...usersToAdd}, usersToRemove: {...usersToRemove}, usersToRemoveCount, saveNeeded: true});
        this.props.actions.setNavigationBlocked(true);
    };

    private onToggleArchive = () => {
        const {isLocalArchived, serverError, previousServerError} = this.state;
        const {isDisabled} = this.props;
        if (isDisabled) {
            return;
        }
        const newState: any = {
            saveNeeded: true,
            isLocalArchived: !isLocalArchived,
        };

        if (newState.isLocalArchived) {
            // if the channel is being archived then clear the other server
            // errors, they're no longer relevant.
            newState.previousServerError = serverError;
            newState.serverError = undefined;
        } else {
            // if the channel is being unarchived (maybe the user had toggled
            // and untoggled) the button, so reinstate any server errors that
            // were present.
            newState.serverError = previousServerError;
            newState.previousServerError = undefined;
        }
        this.props.actions.setNavigationBlocked(true);
        this.setState(newState);
    };

    public render = () => {
        const {
            totalGroups,
            saving,
            saveNeeded,
            serverError,
            isSynced,
            isPublic,
            isDefault,
            groups,
            showConvertConfirmModal,
            showRemoveConfirmModal,
            showConvertAndRemoveConfirmModal,
            usersToRemoveCount,
            channelPermissions,
            teamScheme,
            usersToRemove,
            usersToAdd,
            isLocalArchived,
            showArchiveConfirmModal,
        } = this.state;
        const {channel, team} = this.props;

        if (!channel) {
            return null;
        }

        const missingGroup = (og: {id: string}) => !groups.find((g: Group) => g.id === og.id);
        const removedGroups = this.props.groups.filter(missingGroup);
        const nonArchivedContent = (
            <>
                <ConvertConfirmModal
                    show={showConvertConfirmModal}
                    onCancel={this.hideConvertConfirmModal}
                    onConfirm={this.handleSubmit}
                    displayName={channel.display_name || ''}
                    toPublic={isPublic}
                />

                {this.props.channelModerationEnabled &&
                    <ChannelModeration
                        channelPermissions={channelPermissions}
                        onChannelPermissionsChanged={this.channelPermissionsChanged}
                        teamSchemeID={teamScheme?.id}
                        teamSchemeDisplayName={teamScheme?.display_name}
                        guestAccountsEnabled={this.props.guestAccountsEnabled}
                        isPublic={channel.type === Constants.OPEN_CHANNEL}
                        readOnly={this.props.isDisabled}
                    />
                }

                <RemoveConfirmModal
                    show={showRemoveConfirmModal}
                    onCancel={this.hideRemoveConfirmModal}
                    onConfirm={this.handleSubmit}
                    inChannel={true}
                    amount={usersToRemoveCount}
                />

                <ConvertAndRemoveConfirmModal
                    show={showConvertAndRemoveConfirmModal}
                    onCancel={this.hideConvertAndRemoveConfirmModal}
                    onConfirm={this.handleSubmit}
                    displayName={channel.display_name || ''}
                    toPublic={isPublic}
                    removeAmount={usersToRemoveCount}
                />

                <ChannelModes
                    isPublic={isPublic}
                    isSynced={isSynced}
                    isDefault={isDefault}
                    onToggle={this.setToggles}
                    isDisabled={this.props.isDisabled}
                    groupsSupported={this.props.channelGroupsEnabled}
                />

                {this.props.channelGroupsEnabled &&
                    <ChannelGroups
                        synced={isSynced}
                        channel={channel}
                        totalGroups={totalGroups}
                        groups={groups}
                        removedGroups={removedGroups}
                        onAddCallback={this.handleGroupChange}
                        onGroupRemoved={this.handleGroupRemoved}
                        setNewGroupRole={this.setNewGroupRole}
                        isDisabled={this.props.isDisabled}
                    />
                }

                {!isSynced &&
                    <ChannelMembers
                        onRemoveCallback={this.addUserToRemove}
                        onAddCallback={this.addUsersToAdd}
                        usersToRemove={usersToRemove}
                        usersToAdd={usersToAdd}
                        updateRole={this.addRolesToUpdate}
                        channelId={this.props.channelID}
                        isDisabled={this.props.isDisabled}
                    />
                }
            </>
        );
        return (
            <div className='wrapper--fixed'>
                <AdminHeader withBackButton={true}>
                    <div>
                        <BlockableLink
                            to='/admin_console/user_management/channels'
                            className='fa fa-angle-left back'
                        />
                        <FormattedMessage
                            id='admin.channel_settings.channel_detail.channel_configuration'
                            defaultMessage='Channel Configuration'
                        />
                    </div>
                </AdminHeader>
                <div className='admin-console__wrapper'>
                    <div className='admin-console__content'>
                        <ChannelProfile
                            channel={channel}
                            team={team}
                            onToggleArchive={this.onToggleArchive}
                            isArchived={isLocalArchived}
                            isDisabled={this.props.isDisabled}
                        />
                        <ConfirmModal
                            show={showArchiveConfirmModal}
                            title={
                                <FormattedMessage
                                    id='admin.channel_settings.channel_detail.archive_confirm.title'
                                    defaultMessage='Save and Archive Channel'
                                />
                            }
                            message={
                                <FormattedMessage
                                    id='admin.channel_settings.channel_detail.archive_confirm.message'
                                    defaultMessage={'Saving will archive the channel from the team and make it\'s contents inaccessible for all users. Are you sure you wish to save and archive this channel?'}
                                />
                            }
                            confirmButtonText={
                                <FormattedMessage
                                    id='admin.channel_settings.channel_detail.archive_confirm.button'
                                    defaultMessage='Save and Archive Channel'
                                />
                            }
                            onConfirm={this.handleSubmit}
                            onCancel={this.hideArchiveConfirmModal}
                        />
                        {!isLocalArchived && nonArchivedContent}
                    </div>
                </div>

                <SaveChangesPanel
                    saving={saving}
                    saveNeeded={saveNeeded}
                    onClick={this.onSave}
                    serverError={serverError}
                    cancelLink='/admin_console/user_management/channels'
                    isDisabled={this.props.isDisabled}
                />
            </div>
        );
    };
}
