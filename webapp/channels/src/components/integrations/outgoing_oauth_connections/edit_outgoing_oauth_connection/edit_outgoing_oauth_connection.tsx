// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {OutgoingOAuthConnection} from '@mattermost/types/integrations';
import type {Team} from '@mattermost/types/teams';

import type {ActionResult} from 'mattermost-redux/types/actions';

import ConfirmModal from 'components/confirm_modal';
import LoadingScreen from 'components/loading_screen';

import {getHistory} from 'utils/browser_history';

import AbstractOutgoingOAuthConnection from '../abstract_outgoing_oauth_connection';

const HEADER = {id: 'integrations.edit', defaultMessage: 'Edit'};
const FOOTER = {id: 'update_incoming_webhook.update', defaultMessage: 'Update'};
const LOADING = {id: 'update_incoming_webhook.updating', defaultMessage: 'Updating...'};

type Actions = {
    getOutgoingOAuthConnection: (id: string) => OutgoingOAuthConnection;
    editOutgoingOAuthConnection: (connection: OutgoingOAuthConnection) => Promise<ActionResult>;
};

type Props = {
    team: Team;
    outgoingOAuthConnectionId: string;
    outgoingOAuthConnection: OutgoingOAuthConnection;
    actions: Actions;
    enableOAuthServiceProvider: boolean;
};

type State = {
    showConfirmModal: boolean;
    serverError: string;
};

export default class EditOutgoingOAuthConnection extends React.PureComponent<Props, State> {
    newConnection: OutgoingOAuthConnection;

    constructor(props: Props) {
        super(props);

        this.state = {
            showConfirmModal: false,
            serverError: '',
        };
        this.newConnection = this.props.outgoingOAuthConnection;
    }

    componentDidMount() {
        if (this.props.enableOAuthServiceProvider) {
            this.props.actions.getOutgoingOAuthConnection(this.props.outgoingOAuthConnectionId);
        }
    }

    editOutgoingOAuthConnection = async (connection: OutgoingOAuthConnection) => {
        this.newConnection = connection;

        if (this.props.outgoingOAuthConnection.id) {
            connection.id = this.props.outgoingOAuthConnection.id;
        }

        const audienceUrlsSame = (this.props.outgoingOAuthConnection.audiences.length === connection.audiences.length) &&
            this.props.outgoingOAuthConnection.audiences.every((v, i) => v === connection.audiences[i]);

        if (audienceUrlsSame === false) {
            this.handleConfirmModal();
        } else {
            await this.submitOutgoingOAuthConnection();
        }
    };

    handleConfirmModal = () => {
        this.setState({showConfirmModal: true});
    };

    confirmModalDismissed = () => {
        this.setState({showConfirmModal: false});
    };

    submitOutgoingOAuthConnection = async () => {
        this.setState({serverError: ''});

        const res = await this.props.actions.editOutgoingOAuthConnection(this.newConnection);

        if ('data' in res && res.data) {
            getHistory().push(`/${this.props.team.name}/integrations/outgoing-oauth2-connections`);
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
                id='update_outgoing_oauth_connection.confirm'
                defaultMessage='Edit Outgoing OAuth Connection'
            />
        );

        const confirmMessage = (
            <FormattedMessage
                id='update_outgoing_oauth_connection.question'
                defaultMessage='Your changes may break any existing integrations using this connection. Are you sure you would like to update it?'
            />
        );

        return (
            <ConfirmModal
                title={confirmTitle}
                message={confirmMessage}
                confirmButtonText={confirmButton}
                show={this.state.showConfirmModal}
                onConfirm={this.submitOutgoingOAuthConnection}
                onCancel={this.confirmModalDismissed}
            />
        );
    };

    render() {
        if (!this.props.outgoingOAuthConnection) {
            return <LoadingScreen/>;
        }

        return (
            <AbstractOutgoingOAuthConnection
                team={this.props.team}
                header={HEADER}
                footer={FOOTER}
                loading={LOADING}
                renderExtra={this.renderExtra()}
                action={this.editOutgoingOAuthConnection}
                serverError={this.state.serverError}
                initialConnection={this.props.outgoingOAuthConnection}
            />
        );
    }
}
