// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import Permissions from 'mattermost-redux/constants/permissions';

import {isEnterpriseLicense, isNonEnterpriseLicense} from 'utils/license_utils';

import EditPostTimeLimitButton from '../edit_post_time_limit_button';
import EditPostTimeLimitModal from '../edit_post_time_limit_modal';
import PermissionGroup from '../permission_group';

import type {AdditionalValues, Group} from './types';
import type {ClientConfig, ClientLicense} from '@mattermost/types/config';
import type {Role} from '@mattermost/types/roles';

type Props = {
    scope: string;
    config: Partial<ClientConfig>;
    role: Partial<Role>;
    onToggle: (name: string, ids: string[]) => void;
    parentRole?: Partial<Role>;
    selected?: string;
    selectRow: (id: string) => void;
    readOnly?: boolean;
    license?: ClientLicense;
    customGroupsEnabled: boolean;
}

type State = {
    editTimeLimitModalIsVisible: boolean;
}

export default class PermissionsTree extends React.PureComponent<Props, State> {
    static defaultProps: Partial<Props> = {
        role: {
            permissions: [],
        },
    };

    private ADDITIONAL_VALUES: AdditionalValues;
    private groups: Group[];
    constructor(props: Props) {
        super(props);

        this.state = {
            editTimeLimitModalIsVisible: false,
        };

        this.ADDITIONAL_VALUES = {
            edit_post: {
                editTimeLimitButton: (
                    <EditPostTimeLimitButton
                        onClick={this.openPostTimeLimitModal}
                        isDisabled={this.props.readOnly}
                    />
                ),
            },
        };

        this.groups = [
            {
                id: 'teams',
                permissions: [
                    {
                        id: 'send_invites',
                        combined: true,
                        permissions: [
                            Permissions.INVITE_USER,
                            Permissions.GET_PUBLIC_LINK,
                            Permissions.ADD_USER_TO_TEAM,
                        ],
                    },
                    Permissions.CREATE_TEAM,
                ],
            },
            {
                id: 'public_channel',
                permissions: [
                    Permissions.CREATE_PUBLIC_CHANNEL,
                    Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES,
                    {
                        id: 'manage_public_channel_members_and_read_groups',
                        combined: true,
                        permissions: [
                            Permissions.MANAGE_PUBLIC_CHANNEL_MEMBERS,
                            Permissions.READ_PUBLIC_CHANNEL_GROUPS,
                        ],
                    },
                    Permissions.DELETE_PUBLIC_CHANNEL,
                    {
                        id: 'convert_public_channel_to_private',
                        combined: true,
                        permissions: [
                            Permissions.CONVERT_PUBLIC_CHANNEL_TO_PRIVATE,
                            Permissions.CONVERT_PRIVATE_CHANNEL_TO_PUBLIC,
                        ],
                    },
                ],
            },
            {
                id: 'private_channel',
                permissions: [
                    Permissions.CREATE_PRIVATE_CHANNEL,
                    Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES,
                    {
                        id: 'manage_private_channel_members_and_read_groups',
                        combined: true,
                        permissions: [
                            Permissions.MANAGE_PRIVATE_CHANNEL_MEMBERS,
                            Permissions.READ_PRIVATE_CHANNEL_GROUPS,
                        ],
                    },
                    Permissions.DELETE_PRIVATE_CHANNEL,
                ],
            },
            {
                id: 'playbook_public',
                permissions: [
                    Permissions.PLAYBOOK_PUBLIC_CREATE,
                    Permissions.PLAYBOOK_PUBLIC_MANAGE_PROPERTIES,
                    Permissions.PLAYBOOK_PUBLIC_MANAGE_MEMBERS,
                ],
                isVisible: isNonEnterpriseLicense,
            },
            {
                id: 'playbook_public',
                permissions: [
                    Permissions.PLAYBOOK_PUBLIC_CREATE,
                    Permissions.PLAYBOOK_PUBLIC_MANAGE_PROPERTIES,
                    Permissions.PLAYBOOK_PUBLIC_MANAGE_MEMBERS,
                    Permissions.PLAYBOOK_PUBLIC_MAKE_PRIVATE,
                ],
                isVisible: isEnterpriseLicense,
            },
            {
                id: 'playbook_private',
                permissions: [
                    Permissions.PLAYBOOK_PRIVATE_CREATE,
                    Permissions.PLAYBOOK_PRIVATE_MANAGE_PROPERTIES,
                    Permissions.PLAYBOOK_PRIVATE_MANAGE_MEMBERS,
                    Permissions.PLAYBOOK_PRIVATE_MAKE_PUBLIC,
                ],
                isVisible: isEnterpriseLicense,
            },
            {
                id: 'runs',
                permissions: [
                    Permissions.RUN_CREATE,
                ],
            },
            {
                id: 'posts',
                permissions: [
                    {
                        id: 'edit_posts',
                        permissions: [
                            Permissions.EDIT_POST,
                            Permissions.EDIT_OTHERS_POSTS,
                        ],
                    },
                    {
                        id: 'delete_posts',
                        permissions: [
                            Permissions.DELETE_POST,
                            Permissions.DELETE_OTHERS_POSTS,
                        ],
                    },
                    {
                        id: 'reactions',
                        combined: true,
                        permissions: [
                            Permissions.ADD_REACTION,
                            Permissions.REMOVE_REACTION,
                        ],
                    },
                    Permissions.USE_CHANNEL_MENTIONS,
                ],
            },
            {
                id: 'integrations',
                permissions: [
                ],
            },
            {
                id: 'manage_shared_channels',
                permissions: [
                ],
            },
            {
                id: 'custom_groups',
                permissions: [
                    Permissions.CREATE_CUSTOM_GROUP,
                    Permissions.MANAGE_CUSTOM_GROUP_MEMBERS,
                    Permissions.EDIT_CUSTOM_GROUP,
                    Permissions.DELETE_CUSTOM_GROUP,
                    Permissions.RESTORE_CUSTOM_GROUP,
                ],
            },
        ];
        this.updateGroups();
    }

    updateGroups = () => {
        const {config, scope, license} = this.props;

        const teamsGroup = this.groups[0];
        const postsGroup = this.groups[7];
        const integrationsGroup = this.groups[8];
        const sharedChannelsGroup = this.groups[9];
        const customGroupsGroup = this.groups[10];

        if (config.EnableIncomingWebhooks === 'true' && !integrationsGroup.permissions.includes(Permissions.MANAGE_INCOMING_WEBHOOKS)) {
            integrationsGroup.permissions.push(Permissions.MANAGE_INCOMING_WEBHOOKS);
        }
        if (config.EnableOutgoingWebhooks === 'true' && !integrationsGroup.permissions.includes(Permissions.MANAGE_OUTGOING_WEBHOOKS)) {
            integrationsGroup.permissions.push(Permissions.MANAGE_OUTGOING_WEBHOOKS);
        }
        if (config.EnableOAuthServiceProvider === 'true' && !integrationsGroup.permissions.includes(Permissions.MANAGE_OAUTH)) {
            integrationsGroup.permissions.push(Permissions.MANAGE_OAUTH);
        }
        if (config.EnableCommands === 'true' && !integrationsGroup.permissions.includes(Permissions.MANAGE_SLASH_COMMANDS)) {
            integrationsGroup.permissions.push(Permissions.MANAGE_SLASH_COMMANDS);
        }
        if (config.EnableCustomEmoji === 'true' && !integrationsGroup.permissions.includes(Permissions.CREATE_EMOJIS)) {
            integrationsGroup.permissions.push(Permissions.CREATE_EMOJIS);
        }
        if (config.EnableCustomEmoji === 'true' && !integrationsGroup.permissions.includes(Permissions.DELETE_EMOJIS)) {
            integrationsGroup.permissions.push(Permissions.DELETE_EMOJIS);
        }
        if (config.EnableCustomEmoji === 'true' && !integrationsGroup.permissions.includes(Permissions.DELETE_OTHERS_EMOJIS)) {
            integrationsGroup.permissions.push(Permissions.DELETE_OTHERS_EMOJIS);
        }
        if (config.EnableGuestAccounts === 'true' && !teamsGroup.permissions.includes(Permissions.INVITE_GUEST)) {
            teamsGroup.permissions.push(Permissions.INVITE_GUEST);
        }
        if (scope === 'team_scope' && this.groups[0].id !== 'teams_team_scope') {
            this.groups[0].id = 'teams_team_scope';
        }
        if (license?.IsLicensed === 'true' && license?.LDAPGroups === 'true' && !postsGroup.permissions.includes(Permissions.USE_GROUP_MENTIONS)) {
            postsGroup.permissions.push(Permissions.USE_GROUP_MENTIONS);
        }
        postsGroup.permissions.push(Permissions.CREATE_POST);

        if (config.ExperimentalSharedChannels === 'true') {
            sharedChannelsGroup.permissions.push(Permissions.MANAGE_SHARED_CHANNELS);
            sharedChannelsGroup.permissions.push(Permissions.MANAGE_SECURE_CONNECTIONS);
        }
        if (!this.props.customGroupsEnabled) {
            customGroupsGroup?.permissions.pop();
        }

        this.groups = this.groups.filter((group) => {
            if (group.isVisible) {
                return group.isVisible(this.props.license);
            }

            return true;
        });
    };

    openPostTimeLimitModal = () => {
        this.setState({editTimeLimitModalIsVisible: true});
    };

    closePostTimeLimitModal = () => {
        this.setState({editTimeLimitModalIsVisible: false});
    };

    componentDidUpdate(prevProps: Props) {
        if (this.props.config !== prevProps.config || this.props.license !== prevProps.license) {
            this.updateGroups();
        }
    }

    toggleGroup = (ids: string[]) => {
        if (this.props.readOnly) {
            return;
        }
        this.props.onToggle(this.props.role.name!, ids);
    };

    render = () => {
        return (
            <div className='permissions-tree'>
                <div className='permissions-tree--header'>
                    <div className='permission-name'>
                        <FormattedMessage
                            id='admin.permissions.permissionsTree.permission'
                            defaultMessage='Permission'
                        />
                    </div>
                    <div className='permission-description'>
                        <FormattedMessage
                            id='admin.permissions.permissionsTree.description'
                            defaultMessage='Description'
                        />
                    </div>
                </div>
                <div className='permissions-tree--body'>
                    <PermissionGroup
                        key='all'
                        id='all'
                        uniqId={this.props.role.name}
                        selected={this.props.selected}
                        selectRow={this.props.selectRow}
                        readOnly={this.props.readOnly}
                        permissions={this.groups}
                        additionalValues={this.ADDITIONAL_VALUES}
                        role={this.props.role}
                        parentRole={this.props.parentRole}
                        scope={this.props.scope}
                        combined={false}
                        onChange={this.toggleGroup}
                        root={true}
                    />
                </div>
                <EditPostTimeLimitModal
                    onClose={this.closePostTimeLimitModal}
                    show={this.state.editTimeLimitModalIsVisible}
                />
            </div>
        );
    };
}
