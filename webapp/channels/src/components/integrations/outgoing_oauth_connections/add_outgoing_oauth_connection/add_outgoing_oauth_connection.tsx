// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useHistory} from 'react-router-dom';

import type {OutgoingOAuthConnection} from '@mattermost/types/integrations';
import type {Team} from '@mattermost/types/teams';

import type {ActionResult} from 'mattermost-redux/types/actions.js';

import {t} from 'utils/i18n';

import AbstractOutgoingOAuthConnection from '../abstract_outgoing_oauth_connection';

const HEADER = {id: t('add_oauth_app.header'), defaultMessage: 'Add'};
const FOOTER = {id: t('installed_oauth_apps.save'), defaultMessage: 'Save'};
const LOADING = {id: t('installed_oauth_apps.saving'), defaultMessage: 'Saving...'};

export type Props = {

    /**
    * The team data
    */
    team: Team;

    actions: {
        addOutgoingOAuthConnection: (connection: OutgoingOAuthConnection) => Promise<ActionResult>;
    };
};

const AddOutgoingOAuthConnection = ({team, actions}: Props): JSX.Element => {
    const history = useHistory();

    const [serverError, setServerError] = useState('');

    const addOutgoingOAuthConnection = async (connection: OutgoingOAuthConnection) => {
        setServerError('');

        const {data, error} = await actions.addOutgoingOAuthConnection(connection);
        if (data) {
            history.push(`/${team.name}/integrations/confirm?type=outgoing-oauth2-connections&id=${data.id}`); // MICHAEL TODO
            return;
        }

        if (error) {
            setServerError(error.message);
        }
    };

    return (
        <AbstractOutgoingOAuthConnection
            team={team}
            header={HEADER}
            footer={FOOTER}
            loading={LOADING}
            action={addOutgoingOAuthConnection}
            serverError={serverError}
        />
    );
};

export default AddOutgoingOAuthConnection;
