// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import cn from 'classnames';
import React from 'react';
import type {ComponentProps} from 'react';
import {FormattedMessage} from 'react-intl';

import {SyncIcon} from '@mattermost/compass-icons/components';

import Timestamp from 'components/timestamp';
import Tag from 'components/widgets/tag/tag';
import WithTooltip from 'components/with_tooltip';

import './panel_header.scss';

const TIMESTAMP_PROPS: Partial<ComponentProps<typeof Timestamp>> = {
    day: 'numeric',
    useSemanticOutput: false,
    useTime: false,
    units: ['now', 'minute', 'hour', 'day', 'week', 'month', 'year'],
};

type Props = {
    actions: React.ReactNode;
    hover: boolean;
    timestamp: number;
    remote: boolean;
    title: React.ReactNode;
    error?: string;
};

function PanelHeader({
    actions,
    hover,
    timestamp,
    remote,
    title,
    error,
}: Props) {
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
                        {Boolean(timestamp) && (
                            <Timestamp
                                value={new Date(timestamp)}
                                {...TIMESTAMP_PROPS}
                            />
                        )}
                    </div>
                    {!error && (
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
        </header>
    );
}

export default PanelHeader;
