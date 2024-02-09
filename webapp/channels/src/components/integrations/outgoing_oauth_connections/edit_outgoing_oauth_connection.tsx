// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {FormattedMessage, defineMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {OutgoingOAuthConnection} from '@mattermost/types/integrations';
import type {Team} from '@mattermost/types/teams';

import {editOutgoingOAuthConnection, getOutgoingOAuthConnection} from 'mattermost-redux/actions/integrations';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getOutgoingOAuthConnections} from 'mattermost-redux/selectors/entities/integrations';

import ConfirmModal from 'components/confirm_modal';
import LoadingScreen from 'components/loading_screen';

import {getHistory} from 'utils/browser_history';

import AbstractOutgoingOAuthConnection from './abstract_outgoing_oauth_connection';

const HEADER = defineMessage({id: 'integrations.edit', defaultMessage: 'Edit'});
const FOOTER = defineMessage({id: 'edit_outgoing_oauth_connection.update', defaultMessage: 'Update'});
const LOADING = defineMessage({id: 'edit_outgoing_oauth_connection.updating', defaultMessage: 'Updating...'});

type Props = {
    team: Team;
    location: Location;
};

const getConnectionIdFromSearch = (search: string): string => {
    return (new URLSearchParams(search)).get('id') || '';
};

const EditOutgoingOAuthConnection = (props: Props) => {
    const connectionId = getConnectionIdFromSearch(props.location.search);
    const connections = useSelector(getOutgoingOAuthConnections);
    const existingConnection = connections[connectionId];

    const [newConnection, setNewConnection] = useState(existingConnection);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [serverError, setServerError] = useState('');

    const enableOAuthServiceProvider = useSelector(getConfig).EnableOAuthServiceProvider;

    const dispatch = useDispatch();

    useEffect(() => {
        if (enableOAuthServiceProvider) {
            dispatch(getOutgoingOAuthConnection(props.team.id, connectionId));
        }
    }, [connectionId, enableOAuthServiceProvider, props.team, dispatch]);

    const handleInitialSubmit = async (connection: OutgoingOAuthConnection) => {
        setNewConnection(connection);

        if (existingConnection.id) {
            connection.id = existingConnection.id;
        }

        const audienceUrlsSame = (existingConnection.audiences.length === connection.audiences.length) &&
            existingConnection.audiences.every((v, i) => v === connection.audiences[i]);

        if (audienceUrlsSame) {
            await createOutgoingOAuthConnection(connection);
        } else {
            handleConfirmModal();
        }
    };

    const handleConfirmModal = () => {
        setShowConfirmModal(true);
    };

    const confirmModalDismissed = () => {
        setShowConfirmModal(false);
    };

    const createOutgoingOAuthConnection = async (connection: OutgoingOAuthConnection) => {
        setServerError('');

        const res = await dispatch(editOutgoingOAuthConnection(props.team.id, connection));

        if ('data' in res && res.data) {
            getHistory().push(`/${props.team.name}/integrations/outgoing-oauth2-connections`);
            return;
        }

        confirmModalDismissed();

        if ('error' in res) {
            const {error: err} = res as {error: Error};
            setServerError(err.message);
        }
    };

    const renderExtra = () => {
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
                modalClass='integrations-backstage-modal'
                show={showConfirmModal}
                onConfirm={() => createOutgoingOAuthConnection(newConnection)}
                onCancel={confirmModalDismissed}
            />
        );
    };

    if (!existingConnection) {
        return <LoadingScreen/>;
    }

    return (
        <AbstractOutgoingOAuthConnection
            team={props.team}
            header={HEADER}
            footer={FOOTER}
            loading={LOADING}
            renderExtra={renderExtra()}
            submitAction={handleInitialSubmit}
            serverError={serverError}
            initialConnection={existingConnection}
        />
    );
};

export default EditOutgoingOAuthConnection;
