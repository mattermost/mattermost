// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessages, FormattedMessage} from 'react-intl';

import BlockableLink from 'components/admin_console/blockable_link';
import SaveButton from 'components/button/save_button';

const messages = defineMessages({
    saving: {id: 'admin.team_channel_settings.saving', defaultMessage: 'Saving Config...'},
});

type Props = {
    saving: boolean;
    saveNeeded: boolean;
    onClick: () => void;
    cancelLink: string;
    serverError?: JSX.Element | string;
    isDisabled?: boolean;
    savingMessage?: string;
};

const SaveChangesPanel = ({saveNeeded, onClick, saving, serverError, cancelLink, isDisabled, savingMessage}: Props) => {
    return (
        <div className='admin-console-save'>
            <SaveButton
                saving={saving}
                disabled={isDisabled || !saveNeeded}
                onClick={onClick}
                savingMessage={savingMessage ?? messages.saving}
            />
            {
                cancelLink !== '' &&
                    <BlockableLink
                        id='cancelButtonSettings'
                        className='btn btn-quaternary'
                        to={cancelLink}
                    >
                        <FormattedMessage
                            id='admin.team_channel_settings.cancel'
                            defaultMessage='Cancel'
                        />
                    </BlockableLink>
            }
            <div className='error-message'>
                {serverError}
            </div>
        </div>
    );
};

export default SaveChangesPanel;
