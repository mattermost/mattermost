// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {defineMessage} from 'react-intl';
import {useDispatch} from 'react-redux';
import {useHistory} from 'react-router-dom';

import type {OutgoingOAuthConnection} from '@mattermost/types/integrations';
import type {Team} from '@mattermost/types/teams';

import {addOutgoingOAuthConnection} from 'mattermost-redux/actions/integrations';

import AbstractOutgoingOAuthConnection from './abstract_outgoing_oauth_connection';

const HEADER = defineMessage({id: 'add_outgoing_oauth_connection.add', defaultMessage: 'Add'});
const FOOTER = defineMessage({id: 'add_outgoing_oauth_connection.save', defaultMessage: 'Save'});
const LOADING = defineMessage({id: 'add_outgoing_oauth_connection.saving', defaultMessage: 'Saving...'});

export type Props = {
    team: Team;
};

const AddOutgoingOAuthConnection = ({team}: Props): JSX.Element => {
    const dispatch = useDispatch();

    const history = useHistory();

    const [serverError, setServerError] = useState('');

    const submit = async (connection: OutgoingOAuthConnection) => {
        setServerError('');

        const {data, error} = (await dispatch(addOutgoingOAuthConnection(team.id, connection))) as unknown as {data: OutgoingOAuthConnection; error: Error};
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
            submitAction={submit}
            serverError={serverError}
        />
    );
};

export default AddOutgoingOAuthConnection;
