// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useIntl} from 'react-intl';
import type {MessageDescriptor} from 'react-intl';
import {useHistory} from 'react-router-dom';

import type {Command, OutgoingOAuthConnection} from '@mattermost/types/integrations';
import type {IDMappedObjects} from '@mattermost/types/src/utilities';
import type {Team} from '@mattermost/types/teams';

import type {ActionResult} from 'mattermost-redux/types/actions.js';

import AbstractCommand from '../abstract_command';

export type Props = {

    /**
    * The team data
    */
    team: Team;

    outgoingOAuthConnections: IDMappedObjects<OutgoingOAuthConnection>;

    actions: {

        /**
        * The function to call to add new command
        */
        addCommand: (command: Command) => Promise<ActionResult<Command>>;

        getOutgoingOAuthConnections: () => void;
    };
};

const AddCommand = ({team, actions, outgoingOAuthConnections}: Props) => {
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
            outgoingOAuthConnections={outgoingOAuthConnections}
            getOutgoingOAuthConnections={actions.getOutgoingOAuthConnections}
        />
    );
};

export default AddCommand;
