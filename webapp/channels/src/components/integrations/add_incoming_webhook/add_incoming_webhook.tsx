// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {IncomingWebhook} from '@mattermost/types/integrations';
import {Team} from '@mattermost/types/teams';
import React from 'react';

import AbstractIncomingWebhook from 'components/integrations/abstract_incoming_webhook';

import {getHistory} from 'utils/browser_history';
import {t} from 'utils/i18n';

const HEADER = {id: t('integrations.add'), defaultMessage: 'Add'};
const FOOTER = {id: t('add_incoming_webhook.save'), defaultMessage: 'Save'};
const LOADING = {id: t('add_incoming_webhook.saving'), defaultMessage: 'Saving...'};

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
        createIncomingHook: (hook: IncomingWebhook) => Promise<{ data?: IncomingWebhook; error?: Error }>;
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
                header={HEADER}
                footer={FOOTER}
                loading={LOADING}
                enablePostUsernameOverride={this.props.enablePostUsernameOverride}
                enablePostIconOverride={this.props.enablePostIconOverride}
                action={this.addIncomingHook}
                serverError={this.state.serverError}
            />
        );
    }
}
