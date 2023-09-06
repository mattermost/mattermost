// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {OAuthApp} from '@mattermost/types/integrations';
import type {Team} from '@mattermost/types/teams';

import type {ActionResult} from 'mattermost-redux/types/actions';

import ConfirmModal from 'components/confirm_modal';
import LoadingScreen from 'components/loading_screen';

import {getHistory} from 'utils/browser_history';

import AbstractOAuthApp from '../abstract_oauth_app.jsx';

const HEADER = {id: 'integrations.edit', defaultMessage: 'Edit'};
const FOOTER = {id: 'update_incoming_webhook.update', defaultMessage: 'Update'};
const LOADING = {id: 'update_incoming_webhook.updating', defaultMessage: 'Updating...'};

type Actions = {
    getOAuthApp: (id: string) => OAuthApp;
    editOAuthApp: (app: OAuthApp) => Promise<ActionResult>;
};

type Props = {
    team: Team;
    oauthAppId: string;
    oauthApp: OAuthApp;
    actions: Actions;
    enableOAuthServiceProvider: boolean;
};

type State = {
    showConfirmModal: boolean;
    serverError: string;
};

export default class EditOAuthApp extends React.PureComponent<Props, State> {
    newApp: OAuthApp;

    constructor(props: Props) {
        super(props);

        this.state = {
            showConfirmModal: false,
            serverError: '',
        };
        this.newApp = this.props.oauthApp;
    }

    componentDidMount() {
        if (this.props.enableOAuthServiceProvider) {
            this.props.actions.getOAuthApp(this.props.oauthAppId);
        }
    }

    editOAuthApp = async (app: OAuthApp) => {
        this.newApp = app;

        if (this.props.oauthApp.id) {
            app.id = this.props.oauthApp.id;
        }

        const callbackUrlsSame = (this.props.oauthApp.callback_urls.length === app.callback_urls.length) &&
            this.props.oauthApp.callback_urls.every((v, i) => v === app.callback_urls[i]);

        if (callbackUrlsSame === false) {
            this.handleConfirmModal();
        } else {
            await this.submitOAuthApp();
        }
    };

    handleConfirmModal = () => {
        this.setState({showConfirmModal: true});
    };

    confirmModalDismissed = () => {
        this.setState({showConfirmModal: false});
    };

    submitOAuthApp = async () => {
        this.setState({serverError: ''});

        const res = await this.props.actions.editOAuthApp(this.newApp);

        if ('data' in res && res.data) {
            getHistory().push(`/${this.props.team.name}/integrations/oauth2-apps`);
            return;
        }

        this.setState({showConfirmModal: false});

        if ('error' in res) {
            const {error: err} = res;
            this.setState({serverError: err.message});
        }
    };

    renderExtra = () => {
        const confirmButton = (
            <FormattedMessage
                id='update_command.update'
                defaultMessage='Update'
            />
        );

        const confirmTitle = (
            <FormattedMessage
                id='update_oauth_app.confirm'
                defaultMessage='Edit OAuth 2.0 application'
            />
        );

        const confirmMessage = (
            <FormattedMessage
                id='update_oauth_app.question'
                defaultMessage='Your changes may break the existing OAuth 2.0 application. Are you sure you would like to update it?'
            />
        );

        return (
            <ConfirmModal
                title={confirmTitle}
                message={confirmMessage}
                confirmButtonText={confirmButton}
                show={this.state.showConfirmModal}
                onConfirm={this.submitOAuthApp}
                onCancel={this.confirmModalDismissed}
            />
        );
    };

    render() {
        if (!this.props.oauthApp) {
            return <LoadingScreen/>;
        }

        return (
            <AbstractOAuthApp
                team={this.props.team}
                header={HEADER}
                footer={FOOTER}
                loading={LOADING}
                renderExtra={this.renderExtra()}
                action={this.editOAuthApp}
                serverError={this.state.serverError}
                initialApp={this.props.oauthApp}
            />
        );
    }
}
