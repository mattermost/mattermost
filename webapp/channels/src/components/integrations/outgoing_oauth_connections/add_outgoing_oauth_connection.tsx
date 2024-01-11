// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useDispatch} from 'react-redux';
import {useHistory} from 'react-router-dom';

import type {OutgoingOAuthConnection} from '@mattermost/types/integrations';
import type {Team} from '@mattermost/types/teams';

import {addOutgoingOAuthConnection} from 'mattermost-redux/actions/integrations';

import {t} from 'utils/i18n';

import AbstractOutgoingOAuthConnection from './abstract_outgoing_oauth_connection';

const HEADER = {id: t('add_oauth_app.header'), defaultMessage: 'Add'};
const FOOTER = {id: t('installed_oauth_apps.save'), defaultMessage: 'Save'};
const LOADING = {id: t('installed_oauth_apps.saving'), defaultMessage: 'Saving...'};

export type Props = {
    team: Team;
};

const AddOutgoingOAuthConnection = ({team}: Props): JSX.Element => {
    const dispatch = useDispatch();

    const history = useHistory();

    const [serverError, setServerError] = useState('');

    const submit = async (connection: OutgoingOAuthConnection) => {
        setServerError('');

        const {data, error} = (await dispatch(addOutgoingOAuthConnection(connection))) as unknown as {data: OutgoingOAuthConnection; error: Error};
        if (data) {
            history.push(`/${team.name}/integrations/confirm?type=outgoing-oauth2-connections&id=${data.id}`);
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
            action={submit}
            serverError={serverError}
        />
    );
};

export default AddOutgoingOAuthConnection;
