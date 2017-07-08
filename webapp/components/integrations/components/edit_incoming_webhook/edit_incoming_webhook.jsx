// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {browserHistory} from 'react-router/es6';
import LoadingScreen from 'components/loading_screen.jsx';

import AbstractIncomingWebhook from 'components/integrations/components/abstract_incoming_webhook.jsx';

import React from 'react';
import PropTypes from 'prop-types';

const HEADER = {id: 'integrations.edit', defaultMessage: 'Edit'};
const FOOTER = {id: 'update_incoming_webhook.update', defaultMessage: 'Update'};

export default class EditIncomingWebhook extends React.PureComponent {
    static propTypes = {

        /**
        * The current team
        */
        team: PropTypes.object.isRequired,

        /**
        * The incoming webhook to edit
        */
        hook: PropTypes.object,

        /**
        * The id of the incoming webhook to edit
        */
        hookId: PropTypes.string.isRequired,

        /**
        * The request state for updateIncomingHook action. Contains status and error
        */
        updateIncomingHookRequest: PropTypes.object.isRequired,

        actions: PropTypes.shape({

            /**
            * The function to call to update an incoming webhook
            */
            updateIncomingHook: PropTypes.func.isRequired,

            /**
            * The function to call to get an incoming webhook
            */
            getIncomingHook: PropTypes.func.isRequired
        }).isRequired
    }

    constructor(props) {
        super(props);

        this.state = {
            showConfirmModal: false,
            serverError: ''
        };
    }

    componentDidMount() {
        if (window.mm_config.EnableIncomingWebhooks === 'true') {
            this.props.actions.getIncomingHook(this.props.hookId);
        }
    }

    editIncomingHook = async (hook) => {
        this.newHook = hook;

        if (this.props.hook.id) {
            hook.id = this.props.hook.id;
        }

        if (this.props.hook.token) {
            hook.token = this.props.hook.token;
        }

        await this.submitHook();
    }

    submitHook = async () => {
        this.setState({serverError: ''});

        const data = await this.props.actions.updateIncomingHook(this.newHook);

        if (data) {
            browserHistory.push(`/${this.props.team.name}/integrations/incoming_webhooks`);
            return;
        }

        if (this.props.updateIncomingHookRequest.error) {
            this.setState({serverError: this.props.updateIncomingHookRequest.error.message});
        }
    }

    render() {
        if (!this.props.hook) {
            return <LoadingScreen/>;
        }

        return (
            <AbstractIncomingWebhook
                team={this.props.team}
                header={HEADER}
                footer={FOOTER}
                action={this.editIncomingHook}
                serverError={this.state.serverError}
                initialHook={this.props.hook}
            />
        );
    }
}
