// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {WrappedComponentProps} from 'react-intl';
import {FormattedMessage, defineMessage, injectIntl} from 'react-intl';

import type {ChannelWithTeamData} from '@mattermost/types/channels';
import {
    SyncableType,
} from '@mattermost/types/groups';
import type {
    Group,
    GroupChannel,
    GroupPatch,
    GroupTeam,
    SyncablePatch} from '@mattermost/types/groups';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import type {ActionResult} from 'mattermost-redux/types/actions';

import BlockableLink from 'components/admin_console/blockable_link';
import {GroupProfileAndSettings} from 'components/admin_console/group_settings/group_details/group_profile_and_settings';
import GroupTeamsAndChannels from 'components/admin_console/group_settings/group_details/group_teams_and_channels';
import GroupUsers from 'components/admin_console/group_settings/group_details/group_users';
import SaveChangesPanel from 'components/admin_console/team_channel_settings/save_changes_panel';
import ChannelSelectorModal from 'components/channel_selector_modal';
import FormError from 'components/form_error';
import TeamSelectorModal from 'components/team_selector_modal';
import AdminHeader from 'components/widgets/admin_console/admin_header';
import AdminPanel from 'components/widgets/admin_console/admin_panel';
import Menu from 'components/widgets/menu/menu';
import MenuWrapper from 'components/widgets/menu/menu_wrapper';

export type Props = {
    groupID: string;
    group: Group;
    groupTeams: GroupTeam[];
    groupChannels: GroupChannel[];
    members: UserProfile[];
    memberCount: number;
    isDisabled?: boolean;
    actions: {
        getGroup: (id: string) => Promise<ActionResult>;
        getMembers: (
            id: string,
            page?: number,
            perPage?: number
        ) => Promise<ActionResult>;
        getGroupStats: (id: string) => Promise<ActionResult>;
        getGroupSyncables: (
            id: string,
            syncableType: SyncableType
        ) => Promise<ActionResult>;
        link: (
            id: string,
            syncableID: string,
            syncableType: SyncableType,
            patch: SyncablePatch
        ) => Promise<ActionResult>;
        unlink: (
            id: string,
            syncableID: string,
            syncableType: SyncableType
        ) => Promise<ActionResult>;
        patchGroupSyncable: (
            id: string,
            syncableID: string,
            syncableType: SyncableType,
            patch: SyncablePatch
        ) => Promise<ActionResult>;
        patchGroup: (id: string, patch: GroupPatch) => Promise<ActionResult>;
        setNavigationBlocked: (blocked: boolean) => {
            type: 'SET_NAVIGATION_BLOCKED';
            blocked: boolean;
        };
    };
} & WrappedComponentProps;

export type State = {
    loadingTeamsAndChannels: boolean;
    addTeamOpen: boolean;
    addChannelOpen: boolean;
    allowReference: boolean;
    groupMentionName?: string;
    saving: boolean;
    saveNeeded: boolean;
    serverError: JSX.Element | undefined;
    hasAllowReferenceChanged: boolean;
    hasGroupMentionNameChanged: boolean;
    teamsToAdd: GroupTeam[];
    channelsToAdd: GroupChannel[];
    itemsToRemove: any[];
    rolesToChange: Record<string, boolean>;
    groupTeams: GroupTeam[];
    groupChannels: GroupChannel[];
};

class GroupDetails extends React.PureComponent<Props, State> {
    static defaultProps: Partial<Props> = {
        groupID: '',
        members: [],
        groupTeams: [],
        groupChannels: [],
        group: {name: '', allow_reference: false} as Group,
        memberCount: 0,
    };

    constructor(props: Props) {
        super(props);
        this.state = {
            loadingTeamsAndChannels: true,
            addTeamOpen: false,
            addChannelOpen: false,
            allowReference: Boolean(props.group.allow_reference),
            groupMentionName: props.group.name,
            saving: false,
            saveNeeded: false,
            serverError: undefined,
            hasAllowReferenceChanged: false,
            hasGroupMentionNameChanged: false,
            teamsToAdd: [],
            channelsToAdd: [],
            itemsToRemove: [],
            rolesToChange: {},
            groupTeams: [],
            groupChannels: [],
        };
    }

    componentDidMount() {
        const {groupID, actions} = this.props;
        actions.getGroup(groupID);

        Promise.all([
            actions.getGroupSyncables(groupID, SyncableType.Team),
            actions.getGroupSyncables(groupID, SyncableType.Channel),
            actions.getGroupStats(groupID),
        ]).then(() => {
            this.setState({
                loadingTeamsAndChannels: false,
                allowReference: Boolean(this.props.group.allow_reference),
                groupMentionName: this.props.group.name,
            });
        });
    }

    componentDidUpdate(prevProps: Props, prevState: State) {
        // groupchannels
        if (
            prevState.saveNeeded !== this.state.saveNeeded &&
            !this.state.saveNeeded &&
            prevProps.groupChannels === this.props.groupChannels
        ) {
            this.setState({groupChannels: this.props.groupChannels});
        }
        if (prevProps.groupChannels !== this.props.groupChannels) {
            let gcs;
            if (this.state.saveNeeded) {
                const {groupChannels = []} = this.state;
                const stateIDs = groupChannels.map((gc) => gc.channel_id);
                gcs = this.props.groupChannels.
                    filter((gc) => !stateIDs.includes(gc.channel_id)).
                    concat(groupChannels);
            } else {
                gcs = this.props.groupChannels;
            }
            this.setState({groupChannels: gcs});
        }

        // groupteams
        if (
            prevState.saveNeeded !== this.state.saveNeeded &&
            !this.state.saveNeeded &&
            prevProps.groupTeams === this.props.groupTeams
        ) {
            this.setState({groupTeams: this.props.groupTeams});
        }
        if (prevProps.groupTeams !== this.props.groupTeams) {
            let gcs;
            if (this.state.saveNeeded) {
                const {groupTeams = []} = this.state;
                const stateIDs = groupTeams.map((gc) => gc.team_id);
                gcs = this.props.groupTeams.
                    filter((gc) => !stateIDs.includes(gc.team_id)).
                    concat(groupTeams);
            } else {
                gcs = this.props.groupTeams;
            }
            this.setState({groupTeams: gcs});
        }
    }

    openAddChannel = () => {
        this.setState({addChannelOpen: true});
    };

    closeAddChannel = () => {
        this.setState({addChannelOpen: false});
    };

    openAddTeam = () => {
        this.setState({addTeamOpen: true});
    };

    closeAddTeam = () => {
        this.setState({addTeamOpen: false});
    };

    addTeams = (teams: Team[]) => {
        const {groupID} = this.props;
        const {groupTeams = []} = this.state;
        const teamsToAdd: GroupTeam[] = teams.map((team) => ({
            group_id: groupID,
            scheme_admin: false,
            team_display_name: team.display_name,
            team_id: team.id,
            team_type: team.type,
        }));
        this.setState({
            saveNeeded: true,
            groupTeams: groupTeams.concat(teamsToAdd),
            teamsToAdd,
        });
        this.props.actions.setNavigationBlocked(true);
    };

    addChannels = (channels: ChannelWithTeamData[]) => {
        const {groupID} = this.props;
        const {groupChannels = []} = this.state;
        const channelsToAdd: GroupChannel[] = channels.map((channel) => ({
            channel_display_name: channel.display_name,
            channel_id: channel.id,
            channel_type: channel.type,
            group_id: groupID,
            scheme_admin: false,
            team_display_name: channel.team_display_name,
            team_id: channel.team_id,
        }));
        this.setState({
            saveNeeded: true,
            groupChannels: groupChannels.concat(channelsToAdd),
            channelsToAdd,
        });
        this.props.actions.setNavigationBlocked(true);
    };

    onRemoveTeamOrChannel = (id: string, type: string) => {
        const {
            groupTeams,
            groupChannels,
            itemsToRemove = [],
            channelsToAdd,
            teamsToAdd,
        } = this.state;
        const newState: Partial<State> = {
            saveNeeded: true,
            itemsToRemove,
            serverError: undefined,
        };
        const syncableType = this.syncableTypeFromEntryType(type);

        let makeAPIRequest = true;
        if (syncableType === SyncableType.Channel) {
            newState.channelsToAdd = channelsToAdd?.filter(
                (item) => item.channel_id !== id,
            );
            if (
                !this.props.groupChannels.some((item) => item.channel_id === id)
            ) {
                makeAPIRequest = false;
            }
        } else if (syncableType === SyncableType.Team) {
            newState.teamsToAdd = teamsToAdd?.filter(
                (item) => item.team_id !== id,
            );
            if (!this.props.groupTeams.some((item) => item.team_id === id)) {
                makeAPIRequest = false;
            }
        }
        if (makeAPIRequest) {
            itemsToRemove.push({id, type});
        }

        if (
            this.syncableTypeFromEntryType(type) === SyncableType.Team
        ) {
            newState.groupTeams = groupTeams?.filter((gt) => gt.team_id !== id);
        } else {
            newState.groupChannels = groupChannels?.filter(
                (gc) => gc.channel_id !== id,
            );
        }
        this.setState(newState as any);
        this.props.actions.setNavigationBlocked(true);
    };

    syncableTypeFromEntryType = (entryType?: string) => {
        switch (entryType) {
        case 'public-team':
        case 'private-team':
            return SyncableType.Team;
        case 'public-channel':
        case 'private-channel':
            return SyncableType.Channel;
        default:
            return null;
        }
    };

    onChangeRoles = (id: string, type: string, schemeAdmin: boolean) => {
        const {
            rolesToChange = {},
            groupTeams = [],
            groupChannels = [],
        } = this.state;
        let listToUpdate;
        let getId: (item: any) => string;
        let stateKey;

        const key = `${id}/${type}`;
        rolesToChange[key] = schemeAdmin;

        if (
            this.syncableTypeFromEntryType(type) === SyncableType.Team
        ) {
            listToUpdate = groupTeams;
            getId = (item: GroupTeam) => item.team_id;
            stateKey = 'groupTeams';
        } else {
            listToUpdate = groupChannels;
            getId = (item: GroupChannel) => item.channel_id;
            stateKey = 'groupChannels';
        }

        const updatedItems = listToUpdate.map((item) => {
            if (getId(item) === id) {
                item.scheme_admin = schemeAdmin;
            }
            return item;
        }); // clone list of objects

        this.setState({
            saveNeeded: true,
            rolesToChange,
            [stateKey]: updatedItems,
        } as any);
        this.props.actions.setNavigationBlocked(true);
    };

    onMentionToggle = (allowReference: boolean) => {
        const {group} = this.props;
        const originalAllowReference = group.allow_reference;
        const saveNeeded = true;
        let {groupMentionName} = this.state;

        if (!originalAllowReference && allowReference && !groupMentionName) {
            groupMentionName = group.display_name.
                toLowerCase().
                replace(/\s/g, '-');
        }

        this.setState({
            saveNeeded,
            allowReference,
            groupMentionName,
            hasAllowReferenceChanged: allowReference !== originalAllowReference,
        });
        this.props.actions.setNavigationBlocked(saveNeeded);
    };

    onMentionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const {group} = this.props;
        const originalGroupMentionName = group.name;
        const groupMentionName = e.target.value;
        const saveNeeded = true;

        this.setState({
            saveNeeded,
            groupMentionName,
            hasGroupMentionNameChanged:
                groupMentionName !== originalGroupMentionName,
        });
        this.props.actions.setNavigationBlocked(saveNeeded);
    };

    handleSubmit = async () => {
        this.setState({saving: true});

        const patchGroupSuccessful = await this.handlePatchGroup();
        const addsSuccessful = await this.handleAddedTeamsAndChannels();
        const removesSuccessful = await this.handleRemovedTeamsAndChannels();
        const rolesSuccessful = await this.handleRolesToUpdate();

        await Promise.all([
            this.props.actions.getGroupSyncables(
                this.props.groupID,
                SyncableType.Channel,
            ),
            this.props.actions.getGroupSyncables(
                this.props.groupID,
                SyncableType.Team,
            ),
        ]);

        const allSuccuessful =
            patchGroupSuccessful &&
            addsSuccessful &&
            removesSuccessful &&
            rolesSuccessful;

        this.setState({saveNeeded: !allSuccuessful, saving: false});

        this.props.actions.setNavigationBlocked(!allSuccuessful);
    };

    roleChangeKey = (groupTeamOrChannel: {
        type?: SyncableType;
        team_id?: string;
        channel_id?: string;
    }) => {
        let id;
        if (
            this.syncableTypeFromEntryType(groupTeamOrChannel.type) ===
            SyncableType.Team
        ) {
            id = groupTeamOrChannel.team_id;
        } else {
            id = groupTeamOrChannel.channel_id;
        }
        return `${id}/${groupTeamOrChannel.type}`;
    };

    handlePatchGroup = async () => {
        const {
            allowReference,
            groupMentionName,
            hasAllowReferenceChanged,
            hasGroupMentionNameChanged,
        } = this.state;
        let serverError;

        const GroupNameIsTakenError = (
            <FormattedMessage
                id='admin.group_settings.group_detail.duplicateMentionNameError'
                defaultMessage='Group mention is already taken.'
            />
        );

        if (!groupMentionName && allowReference) {
            serverError = (
                <FormattedMessage
                    id='admin.group_settings.need_groupname'
                    defaultMessage='You must specify a group mention.'
                />
            );
            this.setState({allowReference, serverError});
            return false;
        } else if (hasAllowReferenceChanged || hasGroupMentionNameChanged) {
            let lcGroupMentionName;
            if (allowReference) {
                lcGroupMentionName = groupMentionName?.toLowerCase();
            }
            const result = await this.props.actions.patchGroup(
                this.props.groupID,
                {allow_reference: Boolean(allowReference), name: lcGroupMentionName},
            );
            if (result.error) {
                if (
                    result.error.server_error_id ===
                    'store.sql_group.unique_constraint'
                ) {
                    serverError = GroupNameIsTakenError;
                } else if (
                    result.error.server_error_id ===
                    'model.group.name.invalid_chars.app_error'
                ) {
                    serverError = (
                        <FormattedMessage
                            id='admin.group_settings.group_detail.invalidOrReservedMentionNameError'
                            defaultMessage='Only letters (a-z), numbers(0-9), periods, dashes and underscores are allowed.'
                        />
                    );
                } else if (
                    result.error.server_error_id ===
                        'api.ldap_groups.existing_reserved_name_error' ||
                    result.error.server_error_id ===
                        'api.ldap_groups.existing_user_name_error' ||
                    result.error.server_error_id ===
                        'api.ldap_groups.existing_group_name_error'
                ) {
                    serverError = GroupNameIsTakenError;
                } else if (
                    result.error.server_error_id ===
                    'model.group.name.invalid_length.app_error'
                ) {
                    serverError = (
                        <FormattedMessage
                            id='admin.group_settings.group_detail.invalid_length'
                            defaultMessage='Name must be 1 to 64 lowercase alphanumeric characters.'
                        />
                    );
                } else {
                    serverError = result.error?.message;
                }
            }
            this.setState({
                allowReference,
                groupMentionName: lcGroupMentionName,
                serverError,
                hasAllowReferenceChanged: result.error ? hasAllowReferenceChanged : false,
                hasGroupMentionNameChanged: result.error ? hasGroupMentionNameChanged : false,
            });
        }

        return !serverError;
    };

    handleRolesToUpdate = async () => {
        const {rolesToChange} = this.state;
        const promises: Array<Promise<ActionResult>> = [];

        if (rolesToChange) {
            Object.entries(rolesToChange).forEach(([key, value]) => {
                const [syncableID, type] = key.split('/');
                const syncableType = this.syncableTypeFromEntryType(type);
                if (syncableType) {
                    promises.push(
                        this.props.actions.patchGroupSyncable(
                            this.props.groupID,
                            syncableID,
                            syncableType,
                            {scheme_admin: value, auto_add: false},
                        ),
                    );
                }
            });
        }
        const results = await Promise.all(promises);
        const errors = results.
            map((r) => r.error?.message).
            filter((item) => item);
        if (errors.length) {
            this.setState({serverError: <>{errors[0]}</>});
            return false;
        }
        this.setState({rolesToChange: {}});
        return true;
    };

    handleAddedTeamsAndChannels = async () => {
        const {teamsToAdd, channelsToAdd, rolesToChange} = this.state;
        const promises: Array<Promise<ActionResult>> = [];
        if (teamsToAdd?.length) {
            teamsToAdd.forEach((groupTeam) => {
                const roleChangeKey = this.roleChangeKey(groupTeam);
                groupTeam.scheme_admin = rolesToChange?.[roleChangeKey];
                delete rolesToChange?.[roleChangeKey]; // delete the key because it won't need a patch, it's being handled by the link request.
                promises.push(
                    this.props.actions.link(
                        this.props.groupID,
                        groupTeam.team_id,
                        SyncableType.Team,
                        {
                            auto_add: true,
                            scheme_admin: Boolean(groupTeam.scheme_admin),
                        },
                    ),
                );
            });
        }
        if (channelsToAdd?.length) {
            channelsToAdd.forEach((groupChannel) => {
                const roleChangeKey = this.roleChangeKey(groupChannel);
                groupChannel.scheme_admin = rolesToChange?.[roleChangeKey];
                delete rolesToChange?.[roleChangeKey]; // delete the key because it won't need a patch, it's being handled by the link request.
                promises.push(
                    this.props.actions.link(
                        this.props.groupID,
                        groupChannel.channel_id,
                        SyncableType.Channel,
                        {
                            auto_add: true,
                            scheme_admin: groupChannel.scheme_admin,
                        },
                    ),
                );
            });
        }
        const results = await Promise.all(promises);
        const errors = results.
            map((r) => r.error?.message).
            filter((item) => item);
        if (errors.length) {
            this.setState({serverError: <>{errors[0]}</>});
            return false;
        }
        this.setState({teamsToAdd: [], channelsToAdd: []});
        return true;
    };

    handleRemovedTeamsAndChannels = async () => {
        const {itemsToRemove, rolesToChange} = this.state;
        const promises: Array<Promise<ActionResult>> = [];
        if (itemsToRemove.length) {
            itemsToRemove.forEach((item) => {
                delete rolesToChange[this.roleChangeKey(item)]; // no need to update the roles of group-teams that were unlinked.
                const syncableType = this.syncableTypeFromEntryType(item.type);
                if (syncableType) {
                    promises.push(
                        this.props.actions.unlink(
                            this.props.groupID,
                            item.id,
                            syncableType,
                        ),
                    );
                }
            });
        }
        const results = await Promise.all(promises);
        const errors = results.
            map((r) => r.error?.message).
            filter((item) => item);
        if (errors.length) {
            this.setState({serverError: <>{errors[0]}</>});
            return false;
        }
        this.setState({itemsToRemove: []});
        return true;
    };

    render = () => {
        const {group, members, memberCount, isDisabled} = this.props;
        const {groupTeams, groupChannels} = this.state;
        const {
            allowReference,
            groupMentionName,
            saving,
            saveNeeded,
            serverError,
        } = this.state;

        return (
            <div className='wrapper--fixed'>
                <AdminHeader withBackButton={true}>
                    <div>
                        <BlockableLink
                            to='/admin_console/user_management/groups'
                            className='fa fa-angle-left back'
                        />
                        <FormattedMessage
                            id='admin.group_settings.group_detail.group_configuration'
                            defaultMessage='Group Configuration'
                        />
                    </div>
                </AdminHeader>

                <div className='admin-console__wrapper'>
                    <div className='admin-console__content'>
                        <div className='banner info'>
                            <div className='banner__content'>
                                <FormattedMessage
                                    id='admin.group_settings.group_detail.introBanner'
                                    defaultMessage='Configure default teams and channels and view users belonging to this group.'
                                />
                            </div>
                        </div>

                        <GroupProfileAndSettings
                            displayname={group.display_name || ''}
                            mentionname={groupMentionName}
                            allowReference={allowReference}
                            onToggle={this.onMentionToggle}
                            onChange={this.onMentionChange}
                            readOnly={isDisabled}
                        />

                        <AdminPanel
                            id='group_teams_and_channels'
                            title={defineMessage({id: 'admin.group_settings.group_detail.groupTeamsAndChannelsTitle', defaultMessage: 'Team and Channel Membership'})}
                            subtitle={defineMessage({id: 'admin.group_settings.group_detail.groupTeamsAndChannelsDescription', defaultMessage: 'Set default teams and channels for group members. Teams added will include default channels, town-square, and off-topic. Adding a channel without setting the team will add the implied team to the listing below.'})}
                            button={
                                <div className='group-profile-add-menu'>
                                    <MenuWrapper isDisabled={isDisabled}>
                                        <button
                                            type='button'
                                            id='add_team_or_channel'
                                            className='btn btn-primary'
                                        >
                                            <FormattedMessage
                                                id='admin.group_settings.group_details.add_team_or_channel'
                                                defaultMessage='Add Team or Channel'
                                            />
                                            <i className={'fa fa-caret-down'}/>
                                        </button>
                                        <Menu
                                            ariaLabel={this.props.intl.formatMessage({
                                                id: 'admin.group_settings.group_details.menuAriaLabel',
                                                defaultMessage: 'Add Team or Channel Menu',
                                            })}
                                        >
                                            <Menu.ItemAction
                                                id='add_team'
                                                onClick={this.openAddTeam}
                                                text={this.props.intl.formatMessage({
                                                    id: 'admin.group_settings.group_details.add_team',
                                                    defaultMessage: 'Add Team',
                                                })}
                                            />
                                            <Menu.ItemAction
                                                id='add_channel'
                                                onClick={this.openAddChannel}
                                                text={this.props.intl.formatMessage({
                                                    id: 'admin.group_settings.group_details.add_channel',
                                                    defaultMessage: 'Add Channel',
                                                })}
                                            />
                                        </Menu>
                                    </MenuWrapper>
                                </div>
                            }
                        >
                            <GroupTeamsAndChannels
                                id={this.props.groupID}
                                teams={groupTeams}
                                channels={groupChannels}
                                loading={this.state.loadingTeamsAndChannels}
                                onChangeRoles={this.onChangeRoles}
                                onRemoveItem={this.onRemoveTeamOrChannel}
                                isDisabled={isDisabled}
                            />
                        </AdminPanel>
                        {this.state.addTeamOpen && (
                            <TeamSelectorModal
                                onModalDismissed={this.closeAddTeam}
                                onTeamsSelected={this.addTeams}
                                alreadySelected={this.props.groupTeams.map(
                                    (team) => team.team_id,
                                )}
                            />
                        )}
                        {this.state.addChannelOpen && (
                            <ChannelSelectorModal
                                onModalDismissed={this.closeAddChannel}
                                onChannelsSelected={this.addChannels}
                                alreadySelected={this.props.groupChannels.map(
                                    (channel) => channel.channel_id,
                                )}
                                groupID={this.props.groupID}
                            />
                        )}

                        <AdminPanel
                            id='group_users'
                            title={defineMessage({id: 'admin.group_settings.group_detail.groupUsersTitle', defaultMessage: 'Users'})}
                            subtitle={defineMessage({id: 'admin.group_settings.group_detail.groupUsersDescription', defaultMessage: 'Listing of users in Mattermost associated with this group.'})}
                        >
                            <GroupUsers
                                members={members}
                                total={memberCount}
                                groupID={this.props.groupID}
                                getMembers={this.props.actions.getMembers}
                            />
                        </AdminPanel>
                    </div>
                </div>

                <SaveChangesPanel
                    saving={saving}
                    cancelLink='/admin_console/user_management/groups'
                    saveNeeded={saveNeeded}
                    onClick={this.handleSubmit}
                    serverError={
                        serverError && (
                            <FormError
                                iconClassName={'fa-exclamation-triangle'}
                                textClassName={'has-error'}
                                error={serverError}
                            />
                        )
                    }
                />
            </div>
        );
    };
}

export default injectIntl(GroupDetails);
