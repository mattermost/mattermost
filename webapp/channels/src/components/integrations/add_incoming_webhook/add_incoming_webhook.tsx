// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback, useState} from 'react';

import type {IncomingWebhook} from '@mattermost/types/integrations';
import type {Team} from '@mattermost/types/teams';

import type {ActionResult} from 'mattermost-redux/types/actions';

import AbstractIncomingWebhook from 'components/integrations/abstract_incoming_webhook';

import {getHistory} from 'utils/browser_history';
import {t} from 'utils/i18n';

const HEADER = {id: t('integrations.add'), defaultMessage: 'Add'};
const FOOTER = {id: t('add_incoming_webhook.save'), defaultMessage: 'Save'};
const LOADING = {id: t('add_incoming_webhook.saving'), defaultMessage: 'Saving...'};

type Props = {

    /**
    * The current team
    */
    team: Team;

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
        * The function to call to add a new incoming webhook
        */
        createIncomingHook: (hook: IncomingWebhook) => Promise<ActionResult<IncomingWebhook>>;
    };
};

const AddIncomingWebhook = ({
    team,
    enablePostUsernameOverride,
    enablePostIconOverride,
    actions,
}: Props) => {
    const [serverError, setServerError] = useState('');

    const addIncomingHook = useCallback(async (hook: IncomingWebhook) => {
        setServerError('');

        const {data, error} = await actions.createIncomingHook(hook);
        if (data) {
            getHistory().push(`/${team.name}/integrations/confirm?type=incoming_webhooks&id=${data.id}`);
            return;
        }
        if (error) {
            setServerError(error.message);
        }
    }, [actions, team.name]);

    return (
        <AbstractIncomingWebhook
            team={team}
            header={HEADER}
            footer={FOOTER}
            loading={LOADING}
            enablePostUsernameOverride={enablePostUsernameOverride}
            enablePostIconOverride={enablePostIconOverride}
            action={addIncomingHook}
            serverError={serverError}
        />
    );
};
export default memo(AddIncomingWebhook);
