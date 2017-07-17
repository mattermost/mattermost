// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AbstractOutgoingWebhook from 'components/integrations/components/abstract_outgoing_webhook.jsx';
import ConfirmModal from 'components/confirm_modal.jsx';
import LoadingScreen from 'components/loading_screen.jsx';

import React from 'react';
import PropTypes from 'prop-types';
import {browserHistory} from 'react-router/es6';
import {FormattedMessage} from 'react-intl';

const HEADER = {id: 'integrations.edit', defaultMessage: 'Edit'};
const FOOTER = {id: 'update_outgoing_webhook.update', defaultMessage: 'Update'};

export default class EditOutgoingWebhook extends React.PureComponent {
    static propTypes = {

        /**
         * The current team
         */
        team: PropTypes.object.isRequired,

        /**
         * The outgoing webhook to edit
         */
        hook: PropTypes.object,

        /**
         * The id of the outgoing webhook to edit
         */
        hookId: PropTypes.string.isRequired,

        /**
         * The request state for updateOutgoingHook action. Contains status and error
         */
        updateOutgoingHookRequest: PropTypes.object.isRequired,

        actions: PropTypes.shape({

            /**
             * The function to call to update an outgoing webhook
             */
            updateOutgoingHook: PropTypes.func.isRequired,

            /**
             * The function to call to get an outgoing webhook
             */
            getOutgoingHook: PropTypes.func.isRequired
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
        if (window.mm_config.EnableOutgoingWebhooks === 'true') {
            this.props.actions.getOutgoingHook(this.props.hookId);
        }
    }

    editOutgoingHook = async (hook) => {
        this.newHook = hook;

        if (this.props.hook.id) {
            hook.id = this.props.hook.id;
        }

        if (this.props.hook.token) {
            hook.token = this.props.hook.token;
        }

        const triggerWordsSame = (this.props.hook.trigger_words.length === hook.trigger_words.length) &&
            this.props.hook.trigger_words.every((v, i) => v === hook.trigger_words[i]);

        const callbackUrlsSame = (this.props.hook.callback_urls.length === hook.callback_urls.length) &&
            this.props.hook.callback_urls.every((v, i) => v === hook.callback_urls[i]);

        if (this.props.hook.content_type !== hook.content_type ||
            !triggerWordsSame || !callbackUrlsSame) {
            this.handleConfirmModal();
        } else {
            await this.submitHook();
        }
    }

    handleConfirmModal = () => {
        this.setState({showConfirmModal: true});
    }

    confirmModalDismissed = () => {
        this.setState({showConfirmModal: false});
    }

    submitHook = async () => {
        this.setState({serverError: ''});

        const data = await this.props.actions.updateOutgoingHook(this.newHook);

        if (data) {
            browserHistory.push(`/${this.props.team.name}/integrations/outgoing_webhooks`);
            return;
        }

        this.setState({showConfirmModal: false});

        if (this.props.updateOutgoingHookRequest.error) {
            this.setState({serverError: this.props.updateOutgoingHookRequest.error.message});
        }
    }

    renderExtra = () => {
        const confirmButton = (
            <FormattedMessage
                id='update_outgoing_webhook.update'
                defaultMessage='Update'
            />
        );

        const confirmTitle = (
            <FormattedMessage
                id='update_outgoing_webhook.confirm'
                defaultMessage='Edit Outgoing Webhook'
            />
        );

        const confirmMessage = (
            <FormattedMessage
                id='update_outgoing_webhook.question'
                defaultMessage='Your changes may break the existing outgoing webhook. Are you sure you would like to update it?'
            />
        );

        return (
            <ConfirmModal
                title={confirmTitle}
                message={confirmMessage}
                confirmButtonText={confirmButton}
                show={this.state.showConfirmModal}
                onConfirm={this.submitHook}
                onCancel={this.confirmModalDismissed}
            />
        );
    }

    render() {
        if (!this.props.hook) {
            return <LoadingScreen/>;
        }

        return (
            <AbstractOutgoingWebhook
                team={this.props.team}
                header={HEADER}
                footer={FOOTER}
                renderExtra={this.renderExtra()}
                action={this.editOutgoingHook}
                serverError={this.state.serverError}
                initialHook={this.props.hook}
            />
        );
    }
}
