// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AbstractOutgoingWebhook from 'components/integrations/components/abstract_outgoing_webhook.jsx';

import React from 'react';
import {browserHistory} from 'react-router/es6';
import PropTypes from 'prop-types';

const HEADER = {id: 'integrations.add', defaultMessage: 'Add'};
const FOOTER = {id: 'add_outgoing_webhook.save', defaultMessage: 'Save'};

export default class AddOutgoingWebhook extends React.PureComponent {
    static propTypes = {

        /**
         * The current team
         */
        team: PropTypes.object.isRequired,

        /**
         * The request state for createOutgoingHook action. Contains status and error
         */
        createOutgoingHookRequest: PropTypes.object.isRequired,

        actions: PropTypes.shape({

            /**
             * The function to call to add a new outgoing webhook
             */
            createOutgoingHook: PropTypes.func.isRequired
        }).isRequired
    }

    constructor(props) {
        super(props);

        this.state = {
            serverError: ''
        };
    }

    addOutgoingHook = async (hook) => {
        this.setState({serverError: ''});

        const data = await this.props.actions.createOutgoingHook(hook);
        if (data) {
            browserHistory.push(`/${this.props.team.name}/integrations/confirm?type=outgoing_webhooks&id=${data.id}`);
            return;
        }

        if (this.props.createOutgoingHookRequest.error) {
            this.setState({serverError: this.props.createOutgoingHookRequest.error.message});
        }
    }

    render() {
        return (
            <AbstractOutgoingWebhook
                team={this.props.team}
                header={HEADER}
                footer={FOOTER}
                renderExtra={''}
                action={this.addOutgoingHook}
                serverError={this.state.serverError}
            />
        );
    }
}
