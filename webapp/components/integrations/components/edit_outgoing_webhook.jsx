// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as AsyncClient from 'utils/async_client.jsx';

import {browserHistory} from 'react-router/es6';
import IntegrationStore from 'stores/integration_store.jsx';
import {loadOutgoingHooks} from 'actions/integration_actions.jsx';

import AbstractOutgoingWebhook from './abstract_outgoing_webhook.jsx';
import ConfirmModal from 'components/confirm_modal.jsx';
import {FormattedMessage} from 'react-intl';
import TeamStore from 'stores/team_store.jsx';

export default class EditOutgoingWebhook extends AbstractOutgoingWebhook {
    constructor(props) {
        super(props);

        this.handleIntegrationChange = this.handleIntegrationChange.bind(this);
        this.handleConfirmModal = this.handleConfirmModal.bind(this);
        this.handleUpdate = this.handleUpdate.bind(this);
        this.submitCommand = this.submitCommand.bind(this);
        this.confirmModalDismissed = this.confirmModalDismissed.bind(this);
        this.originalOutgoingHook = null;

        this.state = {
            showConfirmModal: false
        };
    }

    componentDidMount() {
        IntegrationStore.addChangeListener(this.handleIntegrationChange);

        if (window.mm_config.EnableOutgoingWebhooks === 'true') {
            loadOutgoingHooks();
        }
    }

    componentWillUnmount() {
        IntegrationStore.removeChangeListener(this.handleIntegrationChange);
    }

    handleIntegrationChange() {
        const teamId = TeamStore.getCurrentId();

        this.setState({
            hooks: IntegrationStore.getOutgoingWebhooks(teamId),
            loading: !IntegrationStore.hasReceivedOutgoingWebhooks(teamId)
        });

        if (!this.state.loading) {
            this.originalOutgoingHook = this.state.hooks.filter((hook) => hook.id === this.props.location.query.id)[0];

            this.setState({
                displayName: this.originalOutgoingHook.display_name,
                description: this.originalOutgoingHook.description,
                channelId: this.originalOutgoingHook.channel_id,
                contentType: this.originalOutgoingHook.content_type,
                triggerWhen: this.originalOutgoingHook.trigger_when
            });

            var triggerWords = '';
            if (this.originalOutgoingHook.trigger_words) {
                let i = 0;
                for (i = 0; i < this.originalOutgoingHook.trigger_words.length; i++) {
                    triggerWords += this.originalOutgoingHook.trigger_words[i] + '\n';
                }
            }

            var callbackUrls = '';
            if (this.originalOutgoingHook.callback_urls) {
                let i = 0;
                for (i = 0; i < this.originalOutgoingHook.callback_urls.length; i++) {
                    callbackUrls += this.originalOutgoingHook.callback_urls[i] + '\n';
                }
            }

            this.setState({
                triggerWords,
                callbackUrls
            });
        }
    }

    performAction(hook) {
        this.newHook = hook;

        if (this.originalOutgoingHook.id) {
            hook.id = this.originalOutgoingHook.id;
        }

        if (this.originalOutgoingHook.token) {
            hook.token = this.originalOutgoingHook.token;
        }

        var triggerWordsSame = (this.originalOutgoingHook.trigger_words.length === hook.trigger_words.length) &&
            this.originalOutgoingHook.trigger_words.every((v, i) => v === hook.trigger_words[i]);

        var callbackUrlsSame = (this.originalOutgoingHook.callback_urls.length === hook.callback_urls.length) &&
            this.originalOutgoingHook.callback_urls.every((v, i) => v === hook.callback_urls[i]);

        if (this.originalOutgoingHook.content_type !== hook.content_type ||
            !triggerWordsSame || !callbackUrlsSame) {
            this.handleConfirmModal();
            this.setState({
                saving: false
            });
        } else {
            this.submitCommand();
        }
    }

    handleUpdate() {
        this.setState({
            saving: true,
            serverError: '',
            clientError: ''
        });

        this.submitCommand();
    }

    handleConfirmModal() {
        this.setState({showConfirmModal: true});
    }

    confirmModalDismissed() {
        this.setState({showConfirmModal: false});
    }

    submitCommand() {
        AsyncClient.updateOutgoingHook(
            this.newHook,
            () => {
                browserHistory.push(`/${this.props.team.name}/integrations/outgoing_webhooks`);
            },
            (err) => {
                this.setState({
                    saving: false,
                    showConfirmModal: false,
                    serverError: err.message
                });
            }
        );
    }

    header() {
        return {id: 'integrations.edit', defaultMessage: 'Edit'};
    }

    footer() {
        return {id: 'update_outgoing_webhook.update', defaultMessage: 'Update'};
    }

    renderExtra() {
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
                confirmButton={confirmButton}
                show={this.state.showConfirmModal}
                onConfirm={this.handleUpdate}
                onCancel={this.confirmModalDismissed}
            />
        );
    }
}
