// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useEffect} from 'react';
import {FormattedMessage} from 'react-intl';

import {AlertCircleOutlineIcon} from '@mattermost/compass-icons/components';

import './save_changes_panel.scss';

export type SaveChangesPanelState = 'editing' | 'saved' | 'error' | undefined;

const CLOSE_TIMEOUT = 1200;

type Props = {
    handleSubmit: () => void;
    handleCancel: () => void;
    handleClose: () => void;
    tabChangeError?: boolean;
    state: SaveChangesPanelState;
    customErrorMessage?: string;
    saveButtonText?: React.ReactNode;
    cancelButtonText?: React.ReactNode;
}
function SaveChangesPanel({
    handleSubmit,
    handleCancel,
    handleClose,
    tabChangeError = false,
    state = 'editing',
    customErrorMessage,
    saveButtonText,
    cancelButtonText,
}: Props) {
    const panelClassName = classNames('SaveChangesPanel', {error: tabChangeError || state === 'error'}, {saved: state === 'saved'});
    const messageClassName = classNames('SaveChangesPanel__message', {error: tabChangeError || state === 'error'}, {saved: state === 'saved'});
    const cancelButtonClassName = classNames('SaveChangesPanel__cancel-btn', {error: tabChangeError || state === 'error'}, {saved: state === 'saved'});
    const saveButtonClassName = classNames('SaveChangesPanel__save-btn', {error: tabChangeError || state === 'error'}, {saved: state === 'saved'});

    useEffect(() => {
        let timeoutId: NodeJS.Timeout;
        if (state === 'saved') {
            timeoutId = setTimeout(() => {
                handleClose();
            }, CLOSE_TIMEOUT);
        }

        return () => clearTimeout(timeoutId);
    }, [handleClose, state]);

    const generateMessage = () => {
        if (customErrorMessage && (tabChangeError || state === 'error')) {
            return customErrorMessage;
        }

        if (tabChangeError || state === 'editing') {
            return (
                <FormattedMessage
                    id='saveChangesPanel.message'
                    defaultMessage='You have unsaved changes'
                />
            );
        }

        if (state === 'error') {
            return (
                <FormattedMessage
                    id='saveChangesPanel.error'
                    defaultMessage='There was an error saving your settings'
                />
            );
        }

        return (
            <FormattedMessage
                id='saveChangesPanel.saved'
                defaultMessage='Settings saved'
            />
        );
    };

    const generateControlButtons = () => {
        if (state === 'saved') {
            return (
                <div className='SaveChangesPanel__btn-ctr'>
                    <button
                        id='panelCloseButton'
                        data-testid='panelCloseButton'
                        type='button'
                        className='btn btn-icon btn-sm'
                        onClick={handleClose}
                    >
                        <i
                            className='icon icon-close'
                        />
                    </button>
                </div>
            );
        }

        const saveButtonDisabled = tabChangeError || state === 'error';

        return (
            <div className='SaveChangesPanel__btn-ctr'>
                <button
                    data-testid='SaveChangesPanel__cancel-btn'
                    className={cancelButtonClassName}
                    onClick={handleCancel}
                >
                    {cancelButtonText || (
                        <FormattedMessage
                            id='saveChangesPanel.cancel'
                            defaultMessage='Undo'
                        />
                    )}
                </button>
                <button
                    data-testid='SaveChangesPanel__save-btn'
                    className={saveButtonClassName}
                    onClick={handleSubmit}
                    disabled={saveButtonDisabled}
                >
                    {saveButtonText || (
                        <FormattedMessage
                            id='saveChangesPanel.save'
                            defaultMessage='Save'
                        />
                    )}
                </button>
            </div>
        );
    };

    return (
        <div className={panelClassName}>
            <p className={messageClassName}>
                <AlertCircleOutlineIcon
                    size={18}
                    color={'currentcolor'}
                />
                {generateMessage()}
            </p>
            {generateControlButtons()}
        </div>
    );
}
export default SaveChangesPanel;
