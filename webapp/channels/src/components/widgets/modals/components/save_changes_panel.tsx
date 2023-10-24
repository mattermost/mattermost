// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import './save_changes_panel.scss';
import {AlertCircleOutlineIcon} from '@mattermost/compass-icons/components';

type Props = {
    handleSubmit: () => void;
    handleCancel: () => void;
}
function SaveChangesPanel({handleSubmit, handleCancel}: Props) {
    return (
        <div className='mm-save-changes-panel'>
            <p className='mm-save-changes-panel__message'>
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
                    className='mm-save-changes-panel__cancel-btn'
                    onClick={handleCancel}
                >
                    <FormattedMessage
                        id='saveChangesPanel.cancel'
                        defaultMessage='Undo'
                    />
                </button>
                <button
                    className='mm-save-changes-panel__save-btn'
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
