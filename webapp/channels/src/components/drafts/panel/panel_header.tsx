// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';
import {FormattedMessage} from 'react-intl';

import {SyncIcon} from '@mattermost/compass-icons/components';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import EventTimestamp from 'components/event_timestamp';
import Timestamp from 'components/timestamp';
import Tag from 'components/widgets/tag/tag';

import './panel_header.scss';

const DRAFT_TIMESTAMP_PROPS: Partial<ComponentProps<typeof Timestamp>> = {
    day: 'numeric',
    useSemanticOutput: false,
    useTime: false,
    units: ['now', 'minute', 'hour', 'day', 'week', 'month', 'year'],
};

type Props = {
    kind: 'draft' | 'scheduledPost';
    actions: React.ReactNode;
    timestamp: number;
    remote: boolean;
    title: React.ReactNode;
    error?: string;
};

function PanelHeader({
    kind,
    actions,
    timestamp,
    remote,
    title,
    error,
}: Props) {
    return (
        <div className='PanelHeader'>
            <div className='PanelHeader__left'>{title}</div>
            <div className='PanelHeader__right'>
                <div className='PanelHeader__actions'>
                    {actions}
                </div>
                <div className='PanelHeader__info'>
                    {remote && (
                        <div className='PanelHeader__sync-icon'>
                            <WithTooltip
                                title={
                                    <FormattedMessage
                                        id='drafts.info.sync'
                                        defaultMessage='Updated from another device'
                                    />
                                }
                            >
                                <SyncIcon size={18}/>
                            </WithTooltip>
                        </div>
                    )}
                    <div className='PanelHeader__timestamp'>
                        {
                            Boolean(timestamp) && kind === 'draft' && (
                                <Timestamp
                                    value={new Date(timestamp)}
                                    {...DRAFT_TIMESTAMP_PROPS}
                                />
                            )
                        }

                        {
                            Boolean(timestamp) && kind === 'scheduledPost' && (
                                <FormattedMessage
                                    id='scheduled_post.panel.header.time'
                                    defaultMessage='Send on {scheduledDateTime}'
                                    values={{
                                        scheduledDateTime: (
                                            <EventTimestamp
                                                value={timestamp}
                                                displayContext='scheduled_post'
                                                showTooltip={false}
                                            />
                                        ),
                                    }}
                                />
                            )
                        }
                    </div>

                    {kind === 'draft' && !error && (
                        <Tag
                            variant={'danger'}
                            uppercase={true}
                            text={'draft'}
                        />
                    )}
                    {error && (
                        <Tag
                            text={error}
                            variant={'danger'}
                            uppercase={true}
                            icon={'alert-outline'}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

export default PanelHeader;
