// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as AsyncClient from 'utils/async_client.jsx';
import {browserHistory} from 'react-router/es6';

import AbstractOutgoingWebhook from './abstract_outgoing_webhook.jsx';

export default class AddOutgoingWebhook extends AbstractOutgoingWebhook {
    performAction(hook) {
        AsyncClient.addOutgoingHook(
            hook,
            (data) => {
                browserHistory.push(`/${this.props.team.name}/integrations/confirm?type=outgoing_webhooks&id=${data.id}`);
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
        return {id: 'add_outgoing_webhook.save', defaultMessage: 'Save'};
    }

    renderExtra() {
        return '';
    }
}
