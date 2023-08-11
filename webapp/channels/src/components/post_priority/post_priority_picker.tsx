// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState, memo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import styled from 'styled-components';

import {AlertOutlineIcon, AlertCircleOutlineIcon, MessageTextOutlineIcon, CheckCircleOutlineIcon, BellRingOutlineIcon} from '@mattermost/compass-icons/components';
import type {PostPriorityMetadata} from '@mattermost/types/posts';
import {PostPriority} from '@mattermost/types/posts';

import {getPersistentNotificationIntervalMinutes, isPersistentNotificationsEnabled, isPostAcknowledgementsEnabled} from 'mattermost-redux/selectors/entities/posts';

import BetaTag from 'components/widgets/tag/beta_tag';

import Menu, {MenuGroup, MenuItem, ToggleItem} from './post_priority_picker_item';

import './post_priority_picker.scss';

type Props = {
    settings?: PostPriorityMetadata;
    onClose: () => void;
    onApply: (props: PostPriorityMetadata) => void;
}

const UrgentIcon = styled(AlertOutlineIcon)`
    fill: rgb(var(--semantic-color-danger));
`;

const ImportantIcon = styled(AlertCircleOutlineIcon)`
    fill: rgb(var(--semantic-color-info));
`;

const StandardIcon = styled(MessageTextOutlineIcon)`
    fill: rgba(var(--center-channel-color-rgb), 0.56);
`;

const AcknowledgementIcon = styled(CheckCircleOutlineIcon)`
    fill: rgba(var(--center-channel-color-rgb), 0.56);
`;

const PersistentNotificationsIcon = styled(BellRingOutlineIcon)`
    fill: rgba(var(--center-channel-color-rgb), 0.56);
`;

const Header = styled.h4`
    align-items: center;
    display: flex;
    gap: 8px;
    font-family: 'Open Sans', sans-serif;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0;
    line-height: 20px;
    padding: 14px 16px 6px;
    text-align: left;
`;

const Feedback = styled.a`
    margin-left: auto;
    font-size: 11px;
`;

const Footer = styled.div`
    align-items: center;
    border-top: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    display: flex;
    font-family: Open Sans;
    justify-content: flex-end;
    padding: 16px;
    gap: 8px;
`;

const Picker = styled.div`
    *zoom: 1;
    background: var(--center-channel-bg);
    border-radius: 4px;
    border: solid 1px rgba(var(--center-channel-color-rgb), 0.16);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    display: flex;
    flex-direction: column;
    left: 0;
    margin-right: 3px;
    min-width: 0;
    overflow: hidden;
    user-select: none;
    width: max-content;
`;

function PostPriorityPicker({
    onApply,
    onClose,
    settings,
}: Props) {
    const {formatMessage} = useIntl();
    const [priority, setPriority] = useState<PostPriority|''>(settings?.priority || '');
    const [requestedAck, setRequestedAck] = useState<boolean>(settings?.requested_ack || false);
    const [persistentNotifications, setPersistentNotifications] = useState<boolean>(settings?.persistent_notifications || false);

    const postAcknowledgementsEnabled = useSelector(isPostAcknowledgementsEnabled);
    const persistentNotificationsEnabled = useSelector(isPersistentNotificationsEnabled) && postAcknowledgementsEnabled;
    const interval = useSelector(getPersistentNotificationIntervalMinutes);

    const makeOnSelectPriority = useCallback((type?: PostPriority) => (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        e.preventDefault();

        setPriority(type || '');

        if (!postAcknowledgementsEnabled) {
            onApply({
                priority: type || '',
                requested_ack: false,
                persistent_notifications: false,
            });
            onClose();
        } else if (type !== PostPriority.URGENT) {
            setPersistentNotifications(false);
        }
    }, [onApply, onClose, postAcknowledgementsEnabled]);

    const handleAck = useCallback(() => {
        setRequestedAck(!requestedAck);
    }, [requestedAck]);

    const handlePersistentNotifications = useCallback(() => {
        setPersistentNotifications(!persistentNotifications);
    }, [persistentNotifications]);

    const handleApply = () => {
        onApply({
            priority,
            requested_ack: requestedAck,
            persistent_notifications: persistentNotifications,
        });
        onClose();
    };

    const feedbackLink = postAcknowledgementsEnabled ? 'https://forms.gle/noA8Azg7RdaBZtMB6' : 'https://forms.gle/mMcRFQzyKAo9Sv49A';

    return (
        <Picker className='PostPriorityPicker'>
            <Header className='modal-title'>
                {formatMessage({
                    id: 'post_priority.picker.header',
                    defaultMessage: 'Message priority',
                })}
                <BetaTag/>
                <Feedback
                    href={feedbackLink}
                    target='_blank'
                    rel='noopener noreferrer'
                >
                    <FormattedMessage
                        id={'post_priority.picker.feedback'}
                        defaultMessage={'Give feedback'}
                    />
                </Feedback>
            </Header>
            <div role='application'>
                <Menu className='Menu'>
                    <MenuGroup>
                        <MenuItem
                            id='menu-item-priority-standard'
                            onClick={makeOnSelectPriority()}
                            isSelected={!priority}
                            icon={<StandardIcon size={18}/>}
                            text={formatMessage({
                                id: 'post_priority.priority.standard',
                                defaultMessage: 'Standard',
                            })}
                        />
                        <MenuItem
                            id='menu-item-priority-important'
                            onClick={makeOnSelectPriority(PostPriority.IMPORTANT)}
                            isSelected={priority === PostPriority.IMPORTANT}
                            icon={<ImportantIcon size={18}/>}
                            text={formatMessage({
                                id: 'post_priority.priority.important',
                                defaultMessage: 'Important',
                            })}
                        />
                        <MenuItem
                            id='menu-item-priority-urgent'
                            onClick={makeOnSelectPriority(PostPriority.URGENT)}
                            isSelected={priority === PostPriority.URGENT}
                            icon={<UrgentIcon size={18}/>}
                            text={formatMessage({
                                id: 'post_priority.priority.urgent',
                                defaultMessage: 'Urgent',
                            })}
                        />
                    </MenuGroup>
                    {(postAcknowledgementsEnabled || persistentNotificationsEnabled) && (
                        <MenuGroup>
                            {postAcknowledgementsEnabled && (
                                <ToggleItem
                                    disabled={false}
                                    onClick={handleAck}
                                    toggled={requestedAck}
                                    icon={<AcknowledgementIcon size={18}/>}
                                    text={formatMessage({
                                        id: 'post_priority.requested_ack.text',
                                        defaultMessage: 'Request acknowledgement',
                                    })}
                                    description={formatMessage({
                                        id: 'post_priority.requested_ack.description',
                                        defaultMessage: 'An acknowledgement button will appear with your message',
                                    })}
                                />
                            )}
                            {priority === PostPriority.URGENT && persistentNotificationsEnabled && (
                                <ToggleItem
                                    disabled={priority !== PostPriority.URGENT}
                                    onClick={handlePersistentNotifications}
                                    toggled={persistentNotifications}
                                    icon={<PersistentNotificationsIcon size={18}/>}
                                    text={formatMessage({
                                        id: 'post_priority.persistent_notifications.text',
                                        defaultMessage: 'Send persistent notifications',
                                    })}
                                    description={formatMessage(
                                        {
                                            id: 'post_priority.persistent_notifications.description',
                                            defaultMessage: 'Recipients will be notified every {interval, plural, one {1 minute} other {{interval} minutes}} until they acknowledge or reply',
                                        }, {
                                            interval,
                                        },
                                    )}
                                />
                            )}
                        </MenuGroup>
                    )}
                </Menu>
            </div>
            {postAcknowledgementsEnabled && (
                <Footer>
                    <button
                        type='button'
                        className='PostPriorityPicker__cancel'
                        onClick={onClose}
                    >
                        <FormattedMessage
                            id={'post_priority.picker.cancel'}
                            defaultMessage={'Cancel'}
                        />
                    </button>
                    <button
                        type='button'
                        className='PostPriorityPicker__apply'
                        onClick={handleApply}
                    >
                        <FormattedMessage
                            id={'post_priority.picker.apply'}
                            defaultMessage={'Apply'}
                        />
                    </button>
                </Footer>
            )}
        </Picker>
    );
}

export default memo(PostPriorityPicker);
