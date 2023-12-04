// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import {AlertCircleOutlineIcon} from '@mattermost/compass-icons/components';

import './save_changes_panel.scss';

type Props = {
    handleSubmit: () => void;
    handleCancel: () => void;
    errorState?: boolean;
}
function SaveChangesPanel({handleSubmit, handleCancel, errorState = false}: Props) {
    const panelClassName = classNames('mm-save-changes-panel', {error: errorState});
    const messageClassName = classNames('mm-save-changes-panel__message', {error: errorState});
    const cancelButtonClassName = classNames('mm-save-changes-panel__cancel-btn', {error: errorState});
    const saveButtonClassName = classNames('mm-save-changes-panel__save-btn', {error: errorState});

    return (
        <div className={panelClassName}>
            <p className={messageClassName}>
                <AlertCircleOutlineIcon
                    size={18}
                    color={'currentcolor'}
                />
                <FormattedMessage
                    id='saveChangesPanel.message'
                    defaultMessage='You have unsaved changes'
                />
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
                    <FormattedMessage
                        id='saveChangesPanel.save'
                        defaultMessage='Save'
                    />
                </button>
            </div>
        </div>
    );
}
export default SaveChangesPanel;
