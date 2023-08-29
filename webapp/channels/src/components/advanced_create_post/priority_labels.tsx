// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, CSSProperties} from 'react';
import {FormattedMessage} from 'react-intl';
import styled from 'styled-components';

import {CheckCircleOutlineIcon, BellRingOutlineIcon} from '@mattermost/compass-icons/components';

import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';
import PriorityLabel from 'components/post_priority/post_priority_label';
import {HasNoMentions, HasSpecialMentions} from 'components/post_priority/error_messages';

import Constants from 'utils/constants';

import {PostPriorityMetadata} from '@mattermost/types/posts';

type Props = {
    canRemove: boolean;
    hasError: boolean;
    specialMentions?: {[key: string]: boolean};
    onRemove?: () => void;
    padding?: CSSProperties['padding'];
    persistentNotifications?: PostPriorityMetadata['persistent_notifications'];
    priority?: PostPriorityMetadata['priority'];
    requestedAck?: PostPriorityMetadata['requested_ack'];
};

type StyledProps = {
    hasError: boolean;
};

const Priority = styled.div`
    align-items: center;
    display: flex;
    gap: 6px;
    padding: ${(props: {padding: CSSProperties['padding']}) => props.padding || '14px 16px 0'}
`;

const Acknowledgements = styled.div`
    align-items: center;
    color: ${(props: StyledProps) => (props.hasError ? 'var(--dnd-indicator)' : 'var(--online-indicator)')};
    display: flex;

    > span {
        margin-left: 4px;
        font-size: 11px;
        font-weight: 600;
    }
`;

const Notifications = styled.div`
    align-items: center;
    color: var(--dnd-indicator);
    display: flex;

    > span {
        margin-left: 4px;
        font-size: 11px;
        font-weight: 600;
    }
`;

const Close = styled.button`
    align-items: center;
    color: rgb(var(--center-channel-color));
    display: flex;
    font-size: 17px;
    justify-content: center;
    margin-top: -1px;
    opacity: 0.73;
    visibility: hidden;

    &:hover {
        opacity: 0.73;
    }

    ${Priority}:hover & {
        visibility: visible;
    }
`;

const Error = styled.div`
    color: var(--dnd-indicator);
    font-size: 11px;
    font-weight: 600;
`;

function PriorityLabels({
    canRemove,
    hasError,
    specialMentions,
    onRemove,
    padding,
    persistentNotifications,
    priority,
    requestedAck,
}: Props) {
    return (
        <Priority padding={padding}>
            {priority && (
                <PriorityLabel
                    size='xs'
                    priority={priority}
                />
            )}
            {persistentNotifications && (
                <OverlayTrigger
                    placement='top'
                    delayShow={Constants.OVERLAY_TIME_DELAY}
                    trigger={Constants.OVERLAY_DEFAULT_TRIGGER}
                    overlay={(
                        <Tooltip id='post-priority-picker-persistent-notifications-tooltip'>
                            <FormattedMessage
                                id={'post_priority.persistent_notifications.tooltip'}
                                defaultMessage={'Persistent notifications will be sent'}
                            />
                        </Tooltip>
                    )}
                >
                    <Notifications>
                        <BellRingOutlineIcon size={14}/>
                    </Notifications>
                </OverlayTrigger>
            )}
            {requestedAck && (
                <Acknowledgements hasError={hasError}>
                    <OverlayTrigger
                        placement='top'
                        delayShow={Constants.OVERLAY_TIME_DELAY}
                        trigger={Constants.OVERLAY_DEFAULT_TRIGGER}
                        overlay={(
                            <Tooltip id='post-priority-picker-ack-tooltip'>
                                <FormattedMessage
                                    id={'post_priority.request_acknowledgement.tooltip'}
                                    defaultMessage={'Acknowledgement will be requested'}
                                />
                            </Tooltip>
                        )}
                    >
                        <CheckCircleOutlineIcon size={14}/>
                    </OverlayTrigger>
                    {!(priority) && (
                        <FormattedMessage
                            id={'post_priority.request_acknowledgement'}
                            defaultMessage={'Request acknowledgement'}
                        />
                    )}
                </Acknowledgements>
            )}
            {hasError && (
                <Error>
                    {(specialMentions && Object.values(specialMentions).includes(true)) ? <HasSpecialMentions specialMentions={specialMentions}/> : <HasNoMentions/>}
                </Error>
            )}
            {canRemove && (
                <OverlayTrigger
                    placement='top'
                    delayShow={Constants.OVERLAY_TIME_DELAY}
                    trigger={Constants.OVERLAY_DEFAULT_TRIGGER}
                    overlay={(
                        <Tooltip id='post-priority-picker-tooltip'>
                            <FormattedMessage
                                id={'post_priority.remove'}
                                defaultMessage={'Remove {priority}'}
                                values={{priority}}
                            />
                        </Tooltip>
                    )}
                >
                    <Close
                        type='button'
                        className='close'
                        onClick={onRemove}
                    >
                        <span aria-hidden='true'>{'×'}</span>
                        <span className='sr-only'>
                            <FormattedMessage
                                id={'post_priority.remove'}
                                defaultMessage={'Remove {priority}'}
                                values={{priority}}
                            />
                        </span>
                    </Close>
                </OverlayTrigger>
            )}
        </Priority>
    );
}

export default memo(PriorityLabels);
