// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef, useState, memo} from 'react';
import {useSelector} from 'react-redux';
import {FormattedMessage, useIntl} from 'react-intl';
import styled from 'styled-components';

import {AlertOutlineIcon, AlertCircleOutlineIcon, MessageTextOutlineIcon, CheckCircleOutlineIcon} from '@mattermost/compass-icons/components';

import {isPostAcknowledgementsEnabled} from 'mattermost-redux/selectors/entities/posts';

import BetaTag from '../widgets/tag/beta_tag';

import {PostPriority, PostPriorityMetadata} from '@mattermost/types/posts';

import Menu, {MenuGroup, MenuItem, ToggleItem} from './post_priority_picker_item';
import './post_priority_picker.scss';

type Props = {
    settings?: PostPriorityMetadata;
    onClose: () => void;
    onApply: (props: PostPriorityMetadata) => void;
    placement: string;
    rightOffset?: number;
    topOffset?: number;
    leftOffset?: number;
    style?: React.CSSProperties;
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
    position: absolute;
    z-index: 1100;
    display: flex;
    flex-direction: column;
    border: solid 1px rgba(var(--center-channel-color-rgb), 0.16);
    margin-right: 3px;
    background: var(--center-channel-bg);
    border-radius: 4px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    user-select: none;
    overflow: hidden;
    *zoom: 1;
`;

function PostPriorityPicker({
    leftOffset = 0,
    onApply,
    onClose,
    placement,
    rightOffset = 0,
    settings,
    style,
    topOffset = 0,
}: Props) {
    const {formatMessage} = useIntl();
    const [priority, setPriority] = useState<PostPriority|''>(settings?.priority || '');
    const [requestedAck, setRequestedAck] = useState<boolean>(settings?.requested_ack || false);

    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        ref.current?.focus();
    }, []);

    const postAcknowledgementsEnabled = useSelector(isPostAcknowledgementsEnabled);

    const makeOnSelectPriority = useCallback((type?: PostPriority) => () => {
        setPriority(type || '');

        if (!postAcknowledgementsEnabled) {
            onApply({
                priority: type || '',
                requested_ack: false,
            });
            onClose();
        } else if (type === PostPriority.URGENT) {
            setRequestedAck(true);
        }
    }, [onApply, onClose, postAcknowledgementsEnabled]);

    const handleAck = useCallback(() => {
        setRequestedAck(!requestedAck);
    }, [requestedAck]);

    const handleApply = () => {
        onApply({
            priority,
            requested_ack: requestedAck,
        });
        onClose();
    };

    let pickerStyle: React.CSSProperties = {};
    if (style && !(style.left === 0 && style.top === 0)) {
        if (placement === 'top' || placement === 'bottom') {
            // Only take the top/bottom position passed by React Bootstrap since we want to be left-aligned
            pickerStyle = {
                top: style.top,
                bottom: style.bottom,
                left: leftOffset,
            };
        } else {
            pickerStyle = {...style};
        }

        pickerStyle.top = pickerStyle.top ? Number(pickerStyle.top) + topOffset : topOffset;

        if (pickerStyle.right) {
            pickerStyle.right = Number(pickerStyle.right) + rightOffset;
        }
    }

    const feedbackLink = postAcknowledgementsEnabled ? 'https://forms.gle/noA8Azg7RdaBZtMB6' : 'https://forms.gle/XRb63s3KZqpLNyqr9';

    return (
        <Picker
            ref={ref}
            tabIndex={-1}
            style={pickerStyle}
            className='PostPriorityPicker'
        >
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
                    {postAcknowledgementsEnabled && (
                        <MenuGroup>
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
