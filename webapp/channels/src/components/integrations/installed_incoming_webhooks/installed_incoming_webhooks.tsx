// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {IncomingWebhook, IncomingWebhooksWithCount} from '@mattermost/types/integrations';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';
import type {IDMappedObjects} from '@mattermost/types/utilities';

import type {ActionResult} from 'mattermost-redux/types/actions';

import IncomingWebhooksList from './incoming_webhooks_list';

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

    render() {
        return (
            <IncomingWebhooksList
                incomingWebhooks={this.props.incomingHooks}
                channels={this.props.channels}
                users={this.props.users}
                team={this.props.team}
                canManageOthersWebhooks={this.props.canManageOthersWebhooks}
                currentUser={this.props.user}
                onDelete={this.deleteIncomingWebhook}
                loading={this.state.loading}
            />
        );
    }
}

