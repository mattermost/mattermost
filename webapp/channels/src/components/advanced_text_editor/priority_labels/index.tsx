// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {PostPriorityMetadata} from '@mattermost/types/posts';

import {HasNoMentions, HasSpecialMentions} from 'components/post_priority/error_messages';
import PriorityLabel from 'components/post_priority/post_priority_label';
import WithTooltip from 'components/with_tooltip';

import './priority_labels.scss';

type Props = {
    canRemove: boolean;
    hasError: boolean;
    specialMentions?: {[key: string]: boolean};
    onRemove?: () => void;
    persistentNotifications?: PostPriorityMetadata['persistent_notifications'];
    priority?: PostPriorityMetadata['priority'];
    requestedAck?: PostPriorityMetadata['requested_ack'];
};

function PriorityLabels({
    canRemove,
    hasError,
    specialMentions,
    onRemove,
    persistentNotifications,
    priority,
    requestedAck,
}: Props) {
    const intl = useIntl();

    return (
        <div className='priorityLabelsContainer'>
            {priority && (
                <PriorityLabel
                    size='xs'
                    priority={priority}
                />
            )}
            {persistentNotifications && (
                <WithTooltip
                    title={intl.formatMessage({
                        id: 'post_priority.persistent_notifications.tooltip',
                        defaultMessage: 'Persistent notifications will be sent',
                    })}
                >
                    <span className='icon icon-bell-ring-outline'/>
                </WithTooltip>
            )}
            {requestedAck && (
                <div className={classNames('priorityLabelsAcknowledgements', {hasError})}>
                    <WithTooltip
                        title={intl.formatMessage({
                            id: 'post_priority.request_acknowledgement.tooltip',
                            defaultMessage: 'Acknowledgement will be requested',
                        })}
                    >
                        <span className='icon icon-check-circle-outline'/>
                    </WithTooltip>
                    {!(priority) && (
                        <FormattedMessage
                            id={'post_priority.request_acknowledgement'}
                            defaultMessage={'Request acknowledgement'}
                        />
                    )}
                </div>
            )}
            {hasError && (
                <div className='priorityLabelsError'>
                    {(specialMentions && Object.values(specialMentions).includes(true)) ? <HasSpecialMentions specialMentions={specialMentions}/> : <HasNoMentions/>}
                </div>
            )}
            {canRemove && (
                <WithTooltip
                    title={intl.formatMessage({
                        id: 'post_priority.remove',
                        defaultMessage: 'Remove {priority}',
                    }, {priority})}
                >
                    <button
                        className='priorityLabelsClose close'
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
                    </button>
                </WithTooltip>
            )}
        </div>
    );
}

export default memo(PriorityLabels);
