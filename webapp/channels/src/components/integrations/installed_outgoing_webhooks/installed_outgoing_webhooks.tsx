// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {OutgoingWebhook} from '@mattermost/types/integrations';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';
import type {IDMappedObjects} from '@mattermost/types/utilities';

import type {ActionResult} from 'mattermost-redux/types/actions';

import OutgoingWebhooksList from './outgoing_webhooks_list';

import {Constants} from 'utils/constants';

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
        removeOutgoingHook: (hookId: string) => Promise<ActionResult>;

        /**
        * The function to call for outgoingWebhook List and for the status of api
        */
        loadOutgoingHooksAndProfilesForTeam: (teamId: string, page: number, perPage: number) => Promise<ActionResult>;

        /**
        * The function to call for regeneration of webhook token
        */
        regenOutgoingHookToken: (hookId: string) => Promise<ActionResult>;
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
                Constants.Integrations.PAGE_SIZE,
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

    render() {
        return (
            <OutgoingWebhooksList
                outgoingWebhooks={this.props.outgoingWebhooks}
                channels={this.props.channels}
                users={this.props.users}
                team={this.props.team}
                canManageOthersWebhooks={this.props.canManageOthersWebhooks}
                currentUser={this.props.user}
                onDelete={this.removeOutgoingHook}
                onRegenToken={this.regenOutgoingWebhookToken}
                loading={this.state.loading}
            />
        );
    }
}
