// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessages} from 'react-intl';

import type {IncomingWebhook} from '@mattermost/types/integrations';
import type {Team} from '@mattermost/types/teams';

import type {ActionResult} from 'mattermost-redux/types/actions';

import AbstractIncomingWebhook from 'components/integrations/abstract_incoming_webhook';

import {getHistory} from 'utils/browser_history';

const messages = defineMessages({
    footer: {
        id: 'add_incoming_webhook.save',
        defaultMessage: 'Save',
    },
    header: {
        id: 'integrations.add',
        defaultMessage: 'Add',
    },
    loading: {
        id: 'add_incoming_webhook.saving',
        defaultMessage: 'Saving...',
    },
});

type Props = {

    /**
    * The current team
    */
    team: Team;

    /**
    * Whether to allow configuration of the default post username.
    */
    enablePostUsernameOverride: boolean;

    /**
    * Whether to allow configuration of the default post icon.
    */
    enablePostIconOverride: boolean;

    actions: {

        /**
        * The function to call to add a new incoming webhook
        */
        createIncomingHook: (hook: IncomingWebhook) => Promise<ActionResult<IncomingWebhook>>;
    };
};

type State = {
    serverError: string;
};

export default class AddIncomingWebhook extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            serverError: '',
        };
    }

    addIncomingHook = async (hook: IncomingWebhook) => {
        this.setState({serverError: ''});

        const {data, error} = await this.props.actions.createIncomingHook(hook);
        if (data) {
            getHistory().push(`/${this.props.team.name}/integrations/confirm?type=incoming_webhooks&id=${data.id}`);
            return;
        }

        if (error) {
            this.setState({serverError: error.message});
        }
    };

    render() {
        return (
            <AbstractIncomingWebhook
                team={this.props.team}
                header={messages.header}
                footer={messages.footer}
                loading={messages.loading}
                enablePostUsernameOverride={this.props.enablePostUsernameOverride}
                enablePostIconOverride={this.props.enablePostIconOverride}
                action={this.addIncomingHook}
                serverError={this.state.serverError}
            />
        );
    }
}
