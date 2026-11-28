// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback, useEffect} from 'react';
import {FormattedMessage, defineMessage} from 'react-intl';

import ConfirmModal from 'components/confirm_modal';

import type {KindMessages} from 'utils/channel_kind';

import type {ChannelKind} from 'types/store/plugins';

import './channel_activity_warning_modal.scss';

type Props = {

    /** Whether the modal is open/visible */
    isOpen: boolean;

    /** Callback when modal is closed/cancelled */
    onClose: () => void;

    /** Callback when user confirms the action */
    onConfirm: () => void;

    /** The channel's kind, which picks the words: "board" rather than "channel" for a board */
    channelKind?: ChannelKind;
};

/**
 * Modal that warns users about exposing channel history when modifying access rules.
 * Requires user acknowledgment before allowing the action to proceed.
 */
const ChannelActivityWarningModal: React.FC<Props> = ({
    isOpen,
    onClose,
    onConfirm,
    channelKind = 'channel',
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
            title={<FormattedMessage {...messages.title[channelKind]}/>}
            message={
                <div className='channel-activity-warning-content'>
                    <div className='warning-description'>
                        <FormattedMessage
                            id='channel_settings.activity_warning.exposing_history_description'
                            defaultMessage='Modifying access rules may allow new users to view the entire message history, including messages sent before this change.'
                        />
                    </div>
                </div>
            }
            showCheckbox={true}
            checkboxClass='checkbox text-left mb-0 activity-warning-checkbox'
            checkboxText={<FormattedMessage {...messages.acknowledge[channelKind]}/>}
            confirmButtonText={
                <FormattedMessage
                    id='channel_settings.activity_warning.save_and_apply'
                    defaultMessage='Save and apply'
                />
            }
            destructive={true}
            confirmDisabled={!acknowledgeRisk}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
            onCheckboxChange={handleCheckboxChange}
            isStacked={true}
        />
    );
};

const messages = {
    title: {
        channel: defineMessage({
            id: 'channel_settings.activity_warning.exposing_history_title',
            defaultMessage: 'Exposing channel history',
        }),
        board: defineMessage({
            id: 'channel_settings.activity_warning.exposing_history_title.board',
            defaultMessage: 'Exposing board history',
        }),
    },
    acknowledge: {
        channel: defineMessage({
            id: 'channel_settings.activity_warning.acknowledge_expose_history',
            defaultMessage: 'I acknowledge this change will expose all historical channel messages to more users',
        }),
        board: defineMessage({
            id: 'channel_settings.activity_warning.acknowledge_expose_history.board',
            defaultMessage: 'I acknowledge this change will expose all historical board messages to more users',
        }),
    },
} satisfies Record<string, KindMessages>;

export default ChannelActivityWarningModal;
