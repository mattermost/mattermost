// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback, useEffect} from 'react';
import {FormattedMessage} from 'react-intl';

import ConfirmModal from 'components/confirm_modal';

import './channel_activity_warning_modal.scss';

type Props = {

    /** Whether the modal is open/visible */
    isOpen: boolean;

    /** Callback when modal is closed/cancelled */
    onClose: () => void;

    /** Callback when user confirms the action */
    onConfirm: () => void;
};

/**
 * Modal that warns users about exposing channel history when modifying access rules.
 * Requires user acknowledgment before allowing the action to proceed.
 */
const ChannelActivityWarningModal: React.FC<Props> = ({
    isOpen,
    onClose,
    onConfirm,
}) => {
    const [acknowledgeRisk, setAcknowledgeRisk] = useState(false);

    const handleConfirm = useCallback(() => {
        // Only proceed if user has acknowledged the risk
        if (!acknowledgeRisk) {
            return;
        }

        try {
            setAcknowledgeRisk(false); // Reset checkbox after confirmation
            onConfirm();
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Error confirming activity warning:', error);
        }
    }, [acknowledgeRisk, onConfirm]);

    const handleCancel = useCallback(() => {
        setAcknowledgeRisk(false); // Reset checkbox when modal is closed
        onClose();
    }, [onClose]);

    const handleCheckboxChange = useCallback((checked: boolean) => {
        setAcknowledgeRisk(checked);
    }, []);

    // Reset checkbox whenever modal opens (force reset every time)
    useEffect(() => {
        setAcknowledgeRisk(false);
    }, [isOpen]);

    return (
        <ConfirmModal
            id='activityWarningModal'
            show={isOpen}
            title={
                <FormattedMessage
                    id='channel_settings.activity_warning.exposing_history_title'
                    defaultMessage='Exposing channel history'
                />
            }
            message={
                <div className='channel-activity-warning-content'>
                    <div className='warning-description'>
                        <FormattedMessage
                            id='channel_settings.activity_warning.exposing_history_description'
                            defaultMessage='Everyone who gains access to this channel can view the entire message history, including messages that were sent under stricter access rules.'
                        />
                    </div>
                </div>
            }
            showCheckbox={true}
            checkboxClass='checkbox text-left mb-0 activity-warning-checkbox'
            checkboxText={
                <FormattedMessage
                    id='channel_settings.activity_warning.acknowledge_expose_history'
                    defaultMessage='I acknowledge this change will expose all historical channel messages to more users'
                />
            }
            confirmButtonText={
                <FormattedMessage
                    id='channel_settings.activity_warning.save_and_apply'
                    defaultMessage='Save and apply'
                />
            }
            confirmButtonClass='btn btn-danger'
            confirmDisabled={!acknowledgeRisk}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
            onCheckboxChange={handleCheckboxChange}
            isStacked={true}
        />
    );
};

export default ChannelActivityWarningModal;
