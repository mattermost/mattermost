// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import {AlertCircleOutlineIcon} from '@mattermost/compass-icons/components';

import './save_changes_panel.scss';

// todo sinan: add status of saving changes (saving, saved, error)
type Props = {
    handleSubmit: () => void;
    handleCancel: () => void;
    tabChangeError?: boolean;
    serverError?: boolean;
}
function SaveChangesPanel({handleSubmit, handleCancel, tabChangeError = false, serverError = false}: Props) {
    const panelClassName = classNames('mm-save-changes-panel', {error: tabChangeError || serverError});
    const messageClassName = classNames('mm-save-changes-panel__message', {error: tabChangeError || serverError});
    const cancelButtonClassName = classNames('mm-save-changes-panel__cancel-btn', {error: tabChangeError || serverError});
    const saveButtonClassName = classNames('mm-save-changes-panel__save-btn', {error: tabChangeError || serverError});

    return (
        <div className={panelClassName}>
            <p className={messageClassName}>
                <AlertCircleOutlineIcon
                    size={18}
                    color={'currentcolor'}
                />
                {serverError ?
                    <FormattedMessage
                        id='saveChangesPanel.error'
                        defaultMessage='There was an error saving your settings'
                    /> :
                    <FormattedMessage
                        id='saveChangesPanel.message'
                        defaultMessage='You have unsaved changes'
                    />
                }
            </p>
            <div className='mm-save-changes-panel__btn-ctr'>
                <button
                    className={cancelButtonClassName}
                    onClick={handleCancel}
                >
                    <FormattedMessage
                        id='saveChangesPanel.cancel'
                        defaultMessage='Undo'
                    />
                </button>
                <button
                    className={saveButtonClassName}
                    onClick={handleSubmit}
                >
                    {serverError ?
                        <FormattedMessage
                            id='saveChangesPanel.tryAgain'
                            defaultMessage='Try again'
                        /> :
                        <FormattedMessage
                            id='saveChangesPanel.save'
                            defaultMessage='Save'
                        />
                    }
                </button>
            </div>
        </div>
    );
}
export default SaveChangesPanel;
