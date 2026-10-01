// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, type JSX} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {Button} from '@mattermost/compass-ui/components/button';

import {deferNavigation} from 'actions/admin_actions';
import SaveButton from 'components/save_button';
import {getNavigationBlocked} from 'selectors/views/admin';
import {getHistory} from 'utils/browser_history';

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
    const dispatch = useDispatch();
    const navigationBlocked = useSelector(getNavigationBlocked);

    const handleCancelNavigation = useCallback(() => {
        if (!cancelLink) {
            return;
        }

        if (navigationBlocked) {
            dispatch(deferNavigation(() => {
                getHistory().push(cancelLink);
            }));
            return;
        }

        getHistory().push(cancelLink);
    }, [cancelLink, dispatch, navigationBlocked]);

    const showCancel = Boolean(cancelLink) || Boolean(onCancel);

    return (
        <div className='admin-console-save'>
            <SaveButton
                saving={saving}
                disabled={isDisabled || !saveNeeded}
                onClick={onClick}
                savingMessage={savingMessage ?? formatMessage({id: 'admin.team_channel_settings.saving', defaultMessage: 'Saving Config...'})}
            />
            {showCancel && (
                <Button
                    id='cancelButtonSettings'
                    type='button'
                    emphasis='tertiary'
                    onClick={cancelLink ? handleCancelNavigation : () => onCancel?.()}
                >
                    <FormattedMessage
                        id='admin.team_channel_settings.cancel'
                        defaultMessage='Cancel'
                    />
                </Button>
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
