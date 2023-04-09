// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useHistory} from 'react-router-dom';

import {t} from 'utils/i18n';

import AbstractOutgoingWebhook from 'components/integrations/abstract_outgoing_webhook.jsx';

import {Team} from '@mattermost/types/teams';
import {OutgoingWebhook} from '@mattermost/types/integrations';

import {ActionResult} from 'mattermost-redux/types/actions';

const HEADER = {id: t('integrations.add'), defaultMessage: 'Add'};
const FOOTER = {id: t('add_outgoing_webhook.save'), defaultMessage: 'Save'};
const LOADING = {id: t('add_outgoing_webhook.saving'), defaultMessage: 'Saving...'};

export type Props = {

    /**
     * The current team
     */
    team: Team;

    actions: {

        /**
        * The function to call to add a new outgoing webhook
        */
        createOutgoingHook: (hook: OutgoingWebhook) => Promise<ActionResult>;
    };

    /**
     * Whether to allow configuration of the default post username.
     */
    enablePostUsernameOverride: boolean;

    /**
     * Whether to allow configuration of the default post icon.
     */
    enablePostIconOverride: boolean;
};

const AddOutgoingWebhook = ({team, actions, enablePostUsernameOverride, enablePostIconOverride}: Props): JSX.Element => {
    const history = useHistory();

    const [serverError, setServerError] = useState('');

    const addOutgoingHook = async (hook: OutgoingWebhook) => {
        setServerError('');

        const {data, error} = await actions.createOutgoingHook(hook);
        if (data) {
            history.push(`/${team.name}/integrations/confirm?type=outgoing_webhooks&id=${data.id}`);
            return;
        }

        if (error) {
            setServerError(error.message);
        }
    };

    return (
        <AbstractOutgoingWebhook
            team={team}
            header={HEADER}
            footer={FOOTER}
            loading={LOADING}
            renderExtra={''}
            action={addOutgoingHook}
            serverError={serverError}
            enablePostUsernameOverride={enablePostUsernameOverride}
            enablePostIconOverride={enablePostIconOverride}
        />
    );
};

export default AddOutgoingWebhook;
