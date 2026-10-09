// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {
    ChevronLeftIcon,
    ChevronRightIcon,
} from '@mattermost/compass-icons/components';
import {Icon} from '@mattermost/compass-ui/components/icon';
import {IconButton} from '@mattermost/compass-ui/components/icon-button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import type {TableMeta} from './list_table';

interface Props
    extends Pick<TableMeta,
    'onPreviousPageClick' |
    'onNextPageClick' |
    'disablePrevPage' |
    'disableNextPage'
    > {
    isLoading?: boolean;
}

export function Pagination(props: Props) {
    const {formatMessage} = useIntl();

    return (
        <div className='paginationButtons'>
            {props.onPreviousPageClick && (
                <WithTooltip title={formatMessage({id: 'adminConsole.list.table.pagination.previous', defaultMessage: 'Go to previous page'})}>
                    <IconButton
                        size='small'
                        icon={<Icon glyph={<ChevronLeftIcon/>}/>}
                        disabled={props.disablePrevPage || props.isLoading}
                        onClick={props.onPreviousPageClick}
                        aria-label={formatMessage({id: 'adminConsole.list.table.pagination.previous', defaultMessage: 'Go to previous page'})}
                    />
                </WithTooltip>
            )}
            {props.onNextPageClick && (
                <WithTooltip title={formatMessage({id: 'adminConsole.list.table.pagination.next', defaultMessage: 'Go to next page'})}>
                    <IconButton
                        size='small'
                        icon={<Icon glyph={<ChevronRightIcon/>}/>}
                        disabled={props.disableNextPage || props.isLoading}
                        onClick={props.onNextPageClick}
                        aria-label={formatMessage({id: 'adminConsole.list.table.pagination.next', defaultMessage: 'Go to next page'})}
                    />
                </WithTooltip>
            )}
        </div>
    );
}
