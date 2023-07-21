// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Command} from '@mattermost/types/integrations';
import {Team} from '@mattermost/types/teams';
import {ActionResult} from 'mattermost-redux/types/actions.js';
import React, {useState} from 'react';
import {useIntl, MessageDescriptor} from 'react-intl';
import {useHistory} from 'react-router-dom';

import AbstractCommand from '../abstract_command';

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
    const {formatMessage} = useIntl();
    const headerMessage = formatMessage({id: ('integrations.add'), defaultMessage: 'Add'}) as MessageDescriptor;
    const footerMessage = formatMessage({id: ('add_command.save'), defaultMessage: 'Save'}) as MessageDescriptor;
    const loadingMessage = formatMessage({id: ('add_command.saving'), defaultMessage: 'Saving...'}) as MessageDescriptor;
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
            header={headerMessage}
            footer={footerMessage}
            loading={loadingMessage}
            action={addCommand}
            serverError={serverError}
        />
    );
};

export default AddCommand;
