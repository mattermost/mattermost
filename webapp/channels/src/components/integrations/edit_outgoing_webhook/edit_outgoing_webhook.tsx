// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {ServerError} from '@mattermost/types/errors';
import type {OutgoingWebhook} from '@mattermost/types/integrations';
import type {Team} from '@mattermost/types/teams';

import ConfirmModal from 'components/confirm_modal';
import AbstractOutgoingWebhook from 'components/integrations/abstract_outgoing_webhook';
import LoadingScreen from 'components/loading_screen';

import {getHistory} from 'utils/browser_history';

const HEADER = {id: 'integrations.edit', defaultMessage: 'Edit'};
const FOOTER = {id: 'update_outgoing_webhook.update', defaultMessage: 'Update'};
const LOADING = {id: 'update_outgoing_webhook.updating', defaultMessage: 'Updating...'};

interface Props {

    /**
     * The current team
     */
    team: Team;

    /**
     * The outgoing webhook to edit
     */
    hook?: OutgoingWebhook;

    /**
     * The id of the outgoing webhook to edit
     */
    hookId: string;
    actions: {

        /**
         * The function to call to update an outgoing webhook
         */
        updateOutgoingHook: (hook: OutgoingWebhook) => Promise<{ data: OutgoingWebhook; error: ServerError }>;

        /**
         * The function to call to get an outgoing webhook
         */
        getOutgoingHook: (hookId: string) => Promise<{ data: OutgoingWebhook; error: ServerError }>;
    };

    /**
     * Whether or not outgoing webhooks are enabled.
     */
    enableOutgoingWebhooks?: boolean;

    /**
     * Whether to allow configuration of the default post username.
     */
    enablePostUsernameOverride: boolean;

    /**
     * Whether to allow configuration of the default post icon.
     */
    enablePostIconOverride: boolean;
}

interface State {
    showConfirmModal: boolean;
    serverError: string;
}

export default class EditOutgoingWebhook extends React.PureComponent<Props, State> {
    private newHook: OutgoingWebhook | undefined;

    constructor(props: Props) {
        super(props);
        this.state = {
            showConfirmModal: false,
            serverError: '',
        };
    }

    componentDidMount(): void {
        if (this.props.enableOutgoingWebhooks) {
            this.props.actions.getOutgoingHook(this.props.hookId);
        }
    }

    editOutgoingHook = async (hook: OutgoingWebhook): Promise<void> => {
        this.newHook = hook;

        if (this.props.hook!.id) {
            hook.id = this.props.hook!.id;
        }

        if (this.props.hook!.token) {
            hook.token = this.props.hook!.token;
        }

        const triggerWordsSame = (this.props.hook!.trigger_words.length === hook!.trigger_words.length) &&
            this.props.hook!.trigger_words.every((v, i) => v === hook.trigger_words[i]);

        const callbackUrlsSame = (this.props.hook!.callback_urls.length === hook!.callback_urls.length) &&
            this.props.hook!.callback_urls.every((v, i) => v === hook.callback_urls[i]);

        if (this.props.hook!.content_type !== hook.content_type ||
            !triggerWordsSame || !callbackUrlsSame) {
            this.handleConfirmModal();
        } else {
            await this.submitHook();
        }
    };

    handleConfirmModal = (): void => {
        this.setState({showConfirmModal: true});
    };

    confirmModalDismissed = (): void => {
        this.setState({showConfirmModal: false});
    };

    submitHook = async (): Promise<void> => {
        this.setState({serverError: ''});

        const {data, error}: {data: OutgoingWebhook; error: ServerError} = await this.props.actions.updateOutgoingHook(this.newHook!);

        if (data) {
            getHistory().push(`/${this.props.team.name}/integrations/outgoing_webhooks`);
            return;
        }

        this.setState({showConfirmModal: false});

        if (error) {
            this.setState({serverError: error.message});
        }
    };

    renderExtra = (): JSX.Element => {
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
    };

    render(): JSX.Element {
        if (!this.props.hook) {
            return <LoadingScreen/>;
        }

        return (
            <AbstractOutgoingWebhook
                team={this.props.team}
                header={HEADER}
                footer={FOOTER}
                loading={LOADING}
                renderExtra={this.renderExtra()}
                action={this.editOutgoingHook}
                serverError={this.state.serverError}
                initialHook={this.props.hook}
                enablePostUsernameOverride={this.props.enablePostUsernameOverride}
                enablePostIconOverride={this.props.enablePostIconOverride}
            />
        );
    }
}
