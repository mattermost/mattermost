// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Channel} from '@mattermost/types/channels';
import {OutgoingWebhook} from '@mattermost/types/integrations';
import {Team} from '@mattermost/types/teams';
import {UserProfile} from '@mattermost/types/users';
import {IDMappedObjects} from '@mattermost/types/utilities';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import BackstageList from 'components/backstage/components/backstage_list';
import ExternalLink from 'components/external_link';
import FormattedMarkdownMessage from 'components/formatted_markdown_message';
import InstalledOutgoingWebhook, {matchesFilter} from 'components/integrations/installed_outgoing_webhook';

import {Constants, DeveloperLinks} from 'utils/constants';
import {localizeMessage} from 'utils/utils';

export type Props = {

    /**
    *  Data used in passing down as props for webhook modifications
    */
    team: Team;

    /**
    * Data used for checking if webhook is created by current user
    */
    user: UserProfile;

    /**
    *  Data used for checking modification privileges
    */
    canManageOthersWebhooks: boolean;

    /**
    * Data used in passing down as props for showing webhook details
    */
    outgoingWebhooks: OutgoingWebhook[];

    /**
    * Data used in sorting for displaying list and as props channel details
    */
    channels: IDMappedObjects<Channel>;

    /**
    *  Data used in passing down as props for webhook -created by label
    */
    users: IDMappedObjects<UserProfile>;

    /**
    *  Data used in passing as argument for loading webhooks
    */
    teamId: string;

    actions: {

        /**
        * The function to call for removing outgoingWebhook
        */
        removeOutgoingHook: (hookId: string) => Promise<void>;

        /**
        * The function to call for outgoingWebhook List and for the status of api
        */
        loadOutgoingHooksAndProfilesForTeam: (teamId: string, page: number, perPage: number) => Promise<void>;

        /**
        * The function to call for regeneration of webhook token
        */
        regenOutgoingHookToken: (hookId: string) => Promise<void>;
    };

    /**
    * Whether or not outgoing webhooks are enabled.
    */
    enableOutgoingWebhooks: boolean;
}

type State = {
    loading: boolean;
};

export default class InstalledOutgoingWebhooks extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            loading: true,
        };
    }

    componentDidMount() {
        if (this.props.enableOutgoingWebhooks) {
            this.props.actions.loadOutgoingHooksAndProfilesForTeam(
                this.props.teamId,
                Constants.Integrations.START_PAGE_NUM,
                parseInt(Constants.Integrations.PAGE_SIZE, 10),
            ).then(
                () => this.setState({loading: false}),
            );
        }
    }

    regenOutgoingWebhookToken = (outgoingWebhook: OutgoingWebhook) => {
        this.props.actions.regenOutgoingHookToken(outgoingWebhook.id);
    };

    removeOutgoingHook = (outgoingWebhook: OutgoingWebhook) => {
        this.props.actions.removeOutgoingHook(outgoingWebhook.id);
    };

    outgoingWebhookCompare = (a: OutgoingWebhook, b: OutgoingWebhook) => {
        let displayNameA = a.display_name;
        if (!displayNameA) {
            const channelA = this.props.channels[a.channel_id];
            if (channelA) {
                displayNameA = channelA.display_name;
            } else {
                displayNameA = localizeMessage('installed_outgoing_webhooks.unknown_channel', 'A Private Webhook');
            }
        }

        let displayNameB = b.display_name;
        if (!displayNameB) {
            const channelB = this.props.channels[b.channel_id];
            if (channelB) {
                displayNameB = channelB.display_name;
            } else {
                displayNameB = localizeMessage('installed_outgoing_webhooks.unknown_channel', 'A Private Webhook');
            }
        }
        return displayNameA.localeCompare(displayNameB);
    };

    outgoingWebhooks = (filter: string) => this.props.outgoingWebhooks.
        sort(this.outgoingWebhookCompare).
        filter((outgoingWebhook) => matchesFilter(outgoingWebhook, this.props.channels[outgoingWebhook.channel_id], filter)).
        map((outgoingWebhook) => {
            const canChange = this.props.canManageOthersWebhooks || this.props.user.id === outgoingWebhook.creator_id;
            const channel = this.props.channels[outgoingWebhook.channel_id];
            return (
                <InstalledOutgoingWebhook
                    key={outgoingWebhook.id}
                    outgoingWebhook={outgoingWebhook}
                    onRegenToken={this.regenOutgoingWebhookToken}
                    onDelete={this.removeOutgoingHook}
                    creator={this.props.users[outgoingWebhook.creator_id] || {}}
                    canChange={canChange}
                    team={this.props.team}
                    channel={channel}
                />
            );
        });

    render() {
        return (
            <BackstageList
                header={
                    <FormattedMessage
                        id='installed_outgoing_webhooks.header'
                        defaultMessage='Installed Outgoing Webhooks'
                    />
                }
                addText={
                    <FormattedMessage
                        id='installed_outgoing_webhooks.add'
                        defaultMessage='Add Outgoing Webhook'
                    />
                }
                addLink={
                    '/' +
                    this.props.team.name +
                    '/integrations/outgoing_webhooks/add'
                }
                addButtonId='addOutgoingWebhook'
                emptyText={
                    <FormattedMessage
                        id='installed_outgoing_webhooks.empty'
                        defaultMessage='No outgoing webhooks found'
                    />
                }
                emptyTextSearch={
                    <FormattedMarkdownMessage
                        id='installed_outgoing_webhooks.emptySearch'
                        defaultMessage='No outgoing webhooks match {searchTerm}'
                    />
                }
                helpText={
                    <FormattedMessage
                        id='installed_outgoing_webhooks.help'
                        defaultMessage='Use outgoing webhooks to connect external tools to Mattermost. {buildYourOwn} or visit the {appDirectory} to find self-hosted, third-party apps and integrations.'
                        values={{
                            buildYourOwn: (
                                <ExternalLink
                                    href={DeveloperLinks.SETUP_OUTGOING_WEBHOOKS}
                                    location='installed_outgoing_webhooks'
                                >
                                    <FormattedMessage
                                        id='installed_outgoing_webhooks.help.buildYourOwn'
                                        defaultMessage='Build your own'
                                    />
                                </ExternalLink>
                            ),
                            appDirectory: (
                                <ExternalLink
                                    href='https://mattermost.com/marketplace'
                                    location='installed_outgoing_webhooks'
                                >
                                    <FormattedMessage
                                        id='installed_outgoing_webhooks.help.appDirectory'
                                        defaultMessage='App Directory'
                                    />
                                </ExternalLink>
                            ),
                        }}
                    />
                }
                searchPlaceholder={localizeMessage(
                    'installed_outgoing_webhooks.search',
                    'Search Outgoing Webhooks',
                )}
                loading={this.state.loading}
            >
                {(filter: string) => {
                    const children = this.outgoingWebhooks(filter);
                    return [children, children.length > 0];
                }}
            </BackstageList>
        );
    }
}
