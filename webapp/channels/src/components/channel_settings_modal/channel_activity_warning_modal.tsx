// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback} from 'react';
import {FormattedMessage} from 'react-intl';

import {GenericModal} from '@mattermost/components';

import './channel_activity_warning_modal.scss';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    onDontShowAgain: () => Promise<void>;
    channelName: string;
}

const ChannelActivityWarningModal: React.FC<Props> = ({
    isOpen,
    onClose,
    onConfirm,
    onDontShowAgain,
    channelName,
}) => {
    const [dontShowAgain, setDontShowAgain] = useState(false);

    const handleConfirm = useCallback(async () => {
        if (dontShowAgain) {
            // Wait for preference to be saved before continuing
            await onDontShowAgain();
        }
        onConfirm();
    }, [dontShowAgain, onConfirm, onDontShowAgain]);

    return (
        <GenericModal
            className='channel-activity-warning-modal'
            show={isOpen}
            onHide={onClose}
            modalHeaderText={(
                <>
                    <span>
                        <i className='icon icon-alert-outline warning-icon'/>
                    </span>
                    <FormattedMessage
                        id='channel_settings.activity_warning.title'
                        defaultMessage='Channel Activity Warning'
                    />
                </>
            )
            }
            handleCancel={onClose}
            handleConfirm={handleConfirm}
            confirmButtonText={
                <FormattedMessage
                    id='channel_settings.activity_warning.continue'
                    defaultMessage='Continue with Changes'
                />
            }
            cancelButtonText={
                <FormattedMessage
                    id='channel_settings.activity_warning.cancel'
                    defaultMessage='Cancel'
                />
            }
            autoCloseOnConfirmButton={false}
            autoCloseOnCancelButton={false}
            compassDesign={true}
            isStacked={true}
        >
            <div className='channel-activity-warning-content'>
                <div className='warning-description'>
                    <FormattedMessage
                        id='channel_settings.activity_warning.description'
                        defaultMessage='There has been activity in "{channelName}" since the last access rule change. Modifying access rules now might allow new users to see previous chat history.'
                        values={{channelName}}
                    />
                </div>

                <div className='dont-show-again-container'>
                    <input
                        type='checkbox'
                        id='dontShowAgainCheckbox'
                        className='dont-show-again-checkbox'
                        checked={dontShowAgain}
                        onChange={(e) => setDontShowAgain(e.target.checked)}
                    />
                    <label
                        htmlFor='dontShowAgainCheckbox'
                        className='dont-show-again-label'
                    >
                        <FormattedMessage
                            id='channel_settings.activity_warning.dont_show_again'
                            defaultMessage="Don't show this warning again"
                        />
                    </label>
                </div>
            </div>
        </GenericModal>
    );
};

export default ChannelActivityWarningModal;
