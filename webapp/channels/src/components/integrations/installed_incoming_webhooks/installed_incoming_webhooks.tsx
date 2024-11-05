// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {Channel} from '@mattermost/types/channels';
import type {IncomingWebhook, IncomingWebhooksWithCount} from '@mattermost/types/integrations';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';
import type {IDMappedObjects} from '@mattermost/types/utilities';

import type {ActionResult} from 'mattermost-redux/types/actions';

import BackstageList from 'components/backstage/components/backstage_list';
import ExternalLink from 'components/external_link';
import InstalledIncomingWebhook, {matchesFilter} from 'components/integrations/installed_incoming_webhook';

import {DeveloperLinks} from 'utils/constants';
import * as Utils from 'utils/utils';

const PAGE_SIZE = 200;

type Props = {
    team: Team;
    user: UserProfile;
    incomingHooks: IncomingWebhook[];
    incomingHooksTotalCount: number;
    channels: IDMappedObjects<Channel>;
    users: IDMappedObjects<UserProfile>;
    canManageOthersWebhooks: boolean;
    enableIncomingWebhooks: boolean;
    actions: {
        removeIncomingHook: (hookId: string) => Promise<ActionResult>;
        loadIncomingHooksAndProfilesForTeam: (teamId: string, startPageNumber: number,
            pageSize: number, includeTotalCount: boolean) => Promise<ActionResult<IncomingWebhook[] | IncomingWebhooksWithCount>>;
    };
}

type State = {
    page: number;
    loading: boolean;
}

export default class InstalledIncomingWebhooks extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            page: 0,
            loading: true,
        };
    }

    componentDidMount() {
        this.loadPage(0);
    }

    deleteIncomingWebhook = (incomingWebhook: IncomingWebhook) => {
        this.props.actions.removeIncomingHook(incomingWebhook.id);
    };

    loadPage = async (pageToLoad: number) => {
        if (this.props.enableIncomingWebhooks) {
            this.setState({loading: true},
                async () => {
                    await this.props.actions.loadIncomingHooksAndProfilesForTeam(
                        this.props.team.id,
                        pageToLoad,
                        PAGE_SIZE,
                        true,
                    );
                    this.setState({page: pageToLoad, loading: false});
                },
            );
        }
    };

    nextPage = () => {
        this.loadPage(this.state.page + 1);
    };

    previousPage = () => {
        this.loadPage(this.state.page - 1);
    };

    incomingWebhookCompare = (a: IncomingWebhook, b: IncomingWebhook) => {
        let displayNameA = a.display_name;
        if (!displayNameA) {
            const channelA = this.props.channels[a.channel_id];
            if (channelA) {
                displayNameA = channelA.display_name;
            } else {
                displayNameA = Utils.localizeMessage({id: 'installed_incoming_webhooks.unknown_channel', defaultMessage: 'A Private Webhook'});
            }
        }

        const displayNameB = b.display_name;
        return displayNameA.localeCompare(displayNameB);
    };

    incomingWebhooks = (filter: string) => this.props.incomingHooks.
        sort(this.incomingWebhookCompare).
        filter((incomingWebhook: IncomingWebhook) => matchesFilter(incomingWebhook, this.props.channels[incomingWebhook.channel_id], filter)).
        map((incomingWebhook: IncomingWebhook) => {
            const canChange = this.props.canManageOthersWebhooks || this.props.user.id === incomingWebhook.user_id;
            const channel = this.props.channels[incomingWebhook.channel_id];
            return (
                <InstalledIncomingWebhook
                    key={incomingWebhook.id}
                    incomingWebhook={incomingWebhook}
                    onDelete={this.deleteIncomingWebhook}
                    creator={this.props.users[incomingWebhook.user_id] || {}}
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
                        id='installed_incoming_webhooks.header'
                        defaultMessage='Installed Incoming Webhooks'
                    />
                }
                addText={
                    <FormattedMessage
                        id='installed_incoming_webhooks.add'
                        defaultMessage='Add Incoming Webhook'
                    />
                }
                addLink={'/' + this.props.team.name + '/integrations/incoming_webhooks/add'}
                addButtonId='addIncomingWebhook'
                emptyText={
                    <FormattedMessage
                        id='installed_incoming_webhooks.empty'
                        defaultMessage='No incoming webhooks found'
                    />
                }
                emptyTextSearch={
                    <FormattedMessage
                        id='installed_incoming_webhooks.emptySearch'
                        defaultMessage='No incoming webhooks match {searchTerm}'
                    />
                }
                helpText={
                    <FormattedMessage
                        id='installed_incoming_webhooks.help'
                        defaultMessage='Use incoming webhooks to connect external tools to Mattermost. {buildYourOwn} or visit the {appDirectory} to find self-hosted, third-party apps and integrations.'
                        values={{
                            buildYourOwn: (
                                <ExternalLink
                                    location='installed_incoming_webhooks'
                                    href={DeveloperLinks.SETUP_INCOMING_WEBHOOKS}
                                >
                                    <FormattedMessage
                                        id='installed_incoming_webhooks.help.buildYourOwn'
                                        defaultMessage='Build Your Own'
                                    />
                                </ExternalLink>
                            ),
                            appDirectory: (
                                <ExternalLink
                                    href='https://mattermost.com/marketplace'
                                    location='installed_incoming_webhooks'
                                >
                                    <FormattedMessage
                                        id='installed_incoming_webhooks.help.appDirectory'
                                        defaultMessage='App Directory'
                                    />
                                </ExternalLink>
                            ),
                        }}
                    />
                }
                searchPlaceholder={Utils.localizeMessage({id: 'installed_incoming_webhooks.search', defaultMessage: 'Search Incoming Webhooks'})}
                loading={this.state.loading}
                nextPage={this.nextPage}
                previousPage={this.previousPage}
                page={this.state.page}
                pageSize={PAGE_SIZE}
                total={this.props.incomingHooksTotalCount}
            >
                {(filter: string) => {
                    const children = this.incomingWebhooks(filter);
                    return [children, children.length > 0];
                }}
            </BackstageList>
        );
    }
}
