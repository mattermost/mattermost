// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {IncomingWebhook} from '@mattermost/types/integrations';
import type {Team} from '@mattermost/types/teams';

import type {ActionResult} from 'mattermost-redux/types/actions';

import AbstractIncomingWebhook from 'components/integrations/abstract_incoming_webhook';
import LoadingScreen from 'components/loading_screen';

import {getHistory} from 'utils/browser_history';
import {t} from 'utils/i18n';

const HEADER = {id: t('integrations.edit'), defaultMessage: 'Edit'};
const FOOTER = {id: t('update_incoming_webhook.update'), defaultMessage: 'Update'};
const LOADING = {id: t('update_incoming_webhook.updating'), defaultMessage: 'Updating...'};

type Props = {

    /**
     * The current team
     */
    team: Team;

    /**
     * The incoming webhook to edit
     */
    hook?: IncomingWebhook;

    /**
     * The id of the incoming webhook to edit
     */
    hookId: string;

    /**
     * Whether or not incoming webhooks are enabled.
     */
    enableIncomingWebhooks: boolean;

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
         * The function to call to update an incoming webhook
         */
        updateIncomingHook: (hook: IncomingWebhook) => Promise<ActionResult>;

        /**
         * The function to call to get an incoming webhook
         */
        getIncomingHook: (hookId: string) => Promise<ActionResult>;
    };
};

type State = {
    showConfirmModal: boolean;
    serverError: string;
};

export default class EditIncomingWebhook extends React.PureComponent<Props, State> {
    private newHook?: IncomingWebhook;

    constructor(props: Props) {
        super(props);

        this.state = {
            showConfirmModal: false,
            serverError: '',
        };
    }

    componentDidMount() {
        if (this.props.enableIncomingWebhooks) {
            this.props.actions.getIncomingHook(this.props.hookId);
        }
    }

    editIncomingHook = async (hook: IncomingWebhook) => {
        this.newHook = hook;

        if (this.props.hook?.id) {
            hook.id = this.props.hook.id;
        }

        await this.submitHook();
    };

    submitHook = async () => {
        this.setState({serverError: ''});

        if (!this.newHook) {
            return;
        }

        const result = await this.props.actions.updateIncomingHook(this.newHook);

        if ('data' in result) {
            getHistory().push(`/${this.props.team.name}/integrations/incoming_webhooks`);
            return;
        }

        if ('error' in result) {
            const {error} = result;
            this.setState({serverError: error.message});
        }
    };

    render() {
        if (!this.props.hook) {
            return <LoadingScreen/>;
        }

        return (
            <AbstractIncomingWebhook
                team={this.props.team}
                header={HEADER}
                footer={FOOTER}
                loading={LOADING}
                enablePostUsernameOverride={this.props.enablePostUsernameOverride}
                enablePostIconOverride={this.props.enablePostIconOverride}
                action={this.editIncomingHook}
                serverError={this.state.serverError}
                initialHook={this.props.hook}
            />
        );
    }
}
