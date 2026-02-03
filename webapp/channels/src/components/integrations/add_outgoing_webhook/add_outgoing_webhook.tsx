// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {defineMessages} from 'react-intl';
import {useHistory} from 'react-router-dom';

import type {OutgoingWebhook} from '@mattermost/types/integrations';
import type {Team} from '@mattermost/types/teams';

import type {ActionResult} from 'mattermost-redux/types/actions';

import AbstractOutgoingWebhook from 'components/integrations/abstract_outgoing_webhook';

const messages = defineMessages({
    footer: {
        id: 'add_outgoing_webhook.save',
        defaultMessage: 'Save',
    },
    header: {
        id: 'integrations.add',
        defaultMessage: 'Add',
    },
    loading: {
        id: 'add_outgoing_webhook.saving',
        defaultMessage: 'Saving...',
    },
});

export type Props = {

    /**
     * The current team
     */
    team: Team;

    actions: {

        /**
        * The function to call to add a new outgoing webhook
        */
        createOutgoingHook: (hook: OutgoingWebhook) => Promise<ActionResult<OutgoingWebhook>>;
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
            header={messages.header}
            footer={messages.footer}
            loading={messages.loading}
            renderExtra={''}
            action={addOutgoingHook}
            serverError={serverError}
            enablePostUsernameOverride={enablePostUsernameOverride}
            enablePostIconOverride={enablePostIconOverride}
        />
    );
};

export default AddOutgoingWebhook;
