// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as AsyncClient from 'utils/async_client.jsx';
import {browserHistory} from 'react-router/es6';

import AbstractIncomingWebhook from './abstract_incoming_webhook.jsx';

export default class AddIncomingWebhook extends AbstractIncomingWebhook {
    performAction(hook) {
        AsyncClient.addIncomingHook(
            hook,
            (data) => {
                browserHistory.push(`/${this.props.team.name}/integrations/confirm?type=incoming_webhooks&id=${data.id}`);
            },
            (err) => {
                this.setState({
                    saving: false,
                    serverError: err.message
                });
            }
        );
    }

    header() {
        return {id: 'integrations.add', defaultMessage: 'Add'};
    }

    footer() {
        return {id: 'add_incoming_webhook.save', defaultMessage: 'Save'};
    }
}
