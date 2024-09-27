// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import cn from 'classnames';
import React from 'react';
import type {ComponentProps} from 'react';
import {FormattedMessage} from 'react-intl';

import {SyncIcon} from '@mattermost/compass-icons/components';
import type {ScheduledPostErrorCode} from '@mattermost/types/schedule_post';

import ScheduledPostErrorCodeTag from 'components/drafts/scheduled_post_error_code_tag/scheduled_post_error_code_tag';
import Timestamp, {RelativeRanges} from 'components/timestamp';
import Tag from 'components/widgets/tag/tag';
import WithTooltip from 'components/with_tooltip';

import './panel_header.scss';

const TIMESTAMP_PROPS: Partial<ComponentProps<typeof Timestamp>> = {
    day: 'numeric',
    useSemanticOutput: false,
    useTime: false,
    units: ['now', 'minute', 'hour', 'day', 'week', 'month', 'year'],
};

export const SCHEDULED_POST_TIME_RANGES = [
    RelativeRanges.TODAY_TITLE_CASE,
    RelativeRanges.YESTERDAY_TITLE_CASE,
    RelativeRanges.TOMORROW_TITLE_CASE,
];

export const scheduledPostTimeFormat: ComponentProps<typeof Timestamp>['useTime'] = (_, {hour, minute}) => ({hour, minute});

type Props = {
    kind: 'draft' | 'scheduledPost';
    actions: React.ReactNode;
    hover: boolean;
    timestamp: number;
    remote: boolean;
    title: React.ReactNode;
    errorCode?: ScheduledPostErrorCode;
};

function PanelHeader({kind, actions, hover, timestamp, remote, title, errorCode}: Props) {
    return (
        <header className='PanelHeader'>
            <div className='PanelHeader__left'>{title}</div>
            <div className='PanelHeader__right'>
                <div className={cn('PanelHeader__actions', {show: hover})}>
                    {actions}
                </div>
                <div className={cn('PanelHeader__info', {hide: hover})}>
                    {remote && (
                        <div className='PanelHeader__sync-icon'>
                            <WithTooltip
                                id='drafts-sync-tooltip'
                                placement='top'
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
                                    {...TIMESTAMP_PROPS}
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
                                            <Timestamp
                                                value={timestamp}
                                                ranges={SCHEDULED_POST_TIME_RANGES}
                                                useSemanticOutput={false}
                                                useTime={scheduledPostTimeFormat}
                                            />
                                        ),
                                    }}
                                />
                            )
                        }
                    </div>

                    {
                        kind === 'draft' &&
                        <Tag
                            variant={'danger'}
                            uppercase={true}
                            text={'draft'}
                        />
                    }

                    {
                        kind === 'scheduledPost' && errorCode && <ScheduledPostErrorCodeTag errorCode={errorCode}/>
                    }
                </div>
            </div>
        </header>
    );
}

export default PanelHeader;
