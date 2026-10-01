// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {type JSX} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {Button} from '@mattermost/compass-ui/components/button';

import BlockableButton from 'components/admin_console/blockable_button';
import SaveButton from 'components/save_button';

type Props = {
    saving: boolean;
    saveNeeded: boolean;
    onClick: () => void;
    serverError?: JSX.Element | string;
    isDisabled?: boolean;
    savingMessage?: string;
} & (
    {cancelLink: string; onCancel?: never} |
    {cancelLink?: never; onCancel: () => void} |
    {cancelLink?: never; onCancel?: never}
); // allow a cancelLink or an onCancel handler, or neither

const SaveChangesPanel = ({saveNeeded, onClick, saving, serverError, cancelLink, onCancel, isDisabled, savingMessage}: Props) => {
    const {formatMessage} = useIntl();

    const showCancel = Boolean(cancelLink) || Boolean(onCancel);

    const cancelLabel = (
        <FormattedMessage
            id='admin.team_channel_settings.cancel'
            defaultMessage='Cancel'
        />
    );

    return (
        <div className='admin-console-save'>
            <SaveButton
                saving={saving}
                disabled={isDisabled || !saveNeeded}
                onClick={onClick}
                savingMessage={savingMessage ?? formatMessage({id: 'admin.team_channel_settings.saving', defaultMessage: 'Saving Config...'})}
            />
            {showCancel && (
                cancelLink ? (
                    <BlockableButton
                        id='cancelButtonSettings'
                        to={cancelLink}
                    >
                        {cancelLabel}
                    </BlockableButton>
                ) : (
                    <Button
                        id='cancelButtonSettings'
                        type='button'
                        emphasis='tertiary'
                        onClick={() => onCancel?.()}
                    >
                        {cancelLabel}
                    </Button>
                )
            )}
            <div
                className='error-message'
                data-testid='saveChangesPanel-errorMessage'
            >
                {serverError}
            </div>
        </div>
    );
};

export default SaveChangesPanel;
