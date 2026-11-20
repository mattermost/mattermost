// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {type JSX} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {Button} from '@mattermost/compass-ui/components/button';

import BlockableLink from 'components/admin_console/blockable_link';
import SaveButton from 'components/save_button';

type Props = {
    saving: boolean;
    saveNeeded: boolean;
    onClick: () => void;
    serverError?: JSX.Element | string;
    isDisabled?: boolean;
    savingMessage?: string;

    /**
     * The panel's path: `.save--button`, `.cancel--link` (or `.cancel--button`), `.error--text`. Without one the panel
     * keeps `saveSetting` and `saveChangesPanel-errorMessage`.
     */
    testId?: string;
} & (
    {cancelLink: string; onCancel?: never} |
    {cancelLink?: never; onCancel: () => void} |
    {cancelLink?: never; onCancel?: never}
); // allow a cancelLink or an onCancel handler, or neither

const SaveChangesPanel = ({saveNeeded, onClick, saving, serverError, cancelLink, onCancel, isDisabled, savingMessage, testId}: Props) => {
    const {formatMessage} = useIntl();

    const showCancel = Boolean(cancelLink) || Boolean(onCancel);

    const cancelLabel = (
        <FormattedMessage
            id='admin.team_channel_settings.cancel'
            defaultMessage='Cancel'
        />
    );

    return (
        <div
            className='admin-console-save'
            data-testid={testId}
        >
            <SaveButton
                saving={saving}
                disabled={isDisabled || !saveNeeded}
                onClick={onClick}
                testId={testId ? `${testId}.save` : undefined}
                savingMessage={savingMessage ?? formatMessage({id: 'admin.team_channel_settings.saving', defaultMessage: 'Saving Config...'})}
            />
            {showCancel && (
                cancelLink ? (
                    <Button
                        asChild={true}
                        emphasis='tertiary'
                        id='cancelButtonSettings'
                    >
                        <BlockableLink
                            to={cancelLink}
                            data-testid={testId ? `${testId}.cancel--link` : undefined}
                        >
                            {cancelLabel}
                        </BlockableLink>
                    </Button>
                ) : (
                    <Button
                        id='cancelButtonSettings'
                        data-testid={testId ? `${testId}.cancel--button` : undefined}
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
                data-testid={testId ? `${testId}.error--text` : 'saveChangesPanel-errorMessage'}
            >
                {serverError}
            </div>
        </div>
    );
};

export default SaveChangesPanel;
