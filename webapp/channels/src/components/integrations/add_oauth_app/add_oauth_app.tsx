// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {defineMessages} from 'react-intl';
import {useHistory} from 'react-router-dom';

import type {OAuthApp} from '@mattermost/types/integrations';
import type {Team} from '@mattermost/types/teams';

import type {ActionResult} from 'mattermost-redux/types/actions.js';

import AbstractOAuthApp from '../abstract_oauth_app';

const messages = defineMessages({
    footer: {
        id: 'installed_oauth_apps.save',
        defaultMessage: 'Save',
    },
    header: {
        id: 'add_oauth_app.header',
        defaultMessage: 'Add',
    },
    loading: {
        id: 'installed_oauth_apps.saving',
        defaultMessage: 'Saving...',
    },
});

export type Props = {

    /**
    * The team data
    */
    team: Team;

    actions: {

        /**
        * The function to call to add new OAuthApp
        */
        addOAuthApp: (app: OAuthApp) => Promise<ActionResult<OAuthApp>>;
    };
};

const AddOAuthApp = ({team, actions}: Props): JSX.Element => {
    const history = useHistory();

    const [serverError, setServerError] = useState('');

    const addOAuthApp = async (app: OAuthApp) => {
        setServerError('');

        const {data, error} = await actions.addOAuthApp(app);
        if (data) {
            history.push(`/${team.name}/integrations/confirm?type=oauth2-apps&id=${data.id}`);
            return;
        }

        if (error) {
            setServerError(error.message);
        }
    };

    return (
        <AbstractOAuthApp
            team={team}
            header={messages.header}
            footer={messages.footer}
            loading={messages.loading}
            action={addOAuthApp}
            serverError={serverError}
        />
    );
};

export default AddOAuthApp;
