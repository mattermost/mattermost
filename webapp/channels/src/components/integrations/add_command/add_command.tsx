// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useHistory} from 'react-router-dom';

import {Command} from '@mattermost/types/integrations';
import {Team} from '@mattermost/types/teams';

import {ActionResult} from 'mattermost-redux/types/actions.js';

import {t} from 'utils/i18n';

import AbstractCommand from '../abstract_command.jsx';

const HEADER = {id: t('integrations.add'), defaultMessage: 'Add'};
const FOOTER = {id: t('add_command.save'), defaultMessage: 'Save'};
const LOADING = {id: t('add_command.saving'), defaultMessage: 'Saving...'};

export type Props = {

    /**
    * The team data
    */
    team: Team;

    actions: {

        /**
        * The function to call to add new command
        */
        addCommand: (command: Command) => Promise<ActionResult>;
    };
};

const AddCommand = ({team, actions}: Props) => {
    const history = useHistory();

    const [serverError, setServerError] = useState('');

    const addCommand = async (command: Command) => {
        setServerError('');

        const {data, error} = await actions.addCommand(command);
        if (data) {
            history.push(`/${team.name}/integrations/commands/confirm?type=commands&id=${data.id}`);
            return;
        }

        if (error) {
            setServerError(error.message);
        }
    };

    return (
        <AbstractCommand
            team={team}
            header={HEADER}
            footer={FOOTER}
            loading={LOADING}
            renderExtra={''}
            action={addCommand}
            serverError={serverError}
        />
    );
};

export default AddCommand;
