// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import type {TableMeta} from './list_table';

interface Props
    extends Pick<TableMeta,
    | 'onPreviousPageClick'
    | 'onNextPageClick'
    | 'disablePrevPage'
    | 'disableNextPage'
    > {
    isLoading?: boolean;
}

export function Pagination(props: Props) {
    const {formatMessage} = useIntl();

    return (
        <div className='paginationButtons'>
            {props.onPreviousPageClick && (
                <button
                    className='btn btn-icon btn-sm'
                    disabled={props.disablePrevPage || props.isLoading}
                    onClick={props.onPreviousPageClick}
                    aria-label={formatMessage({id: 'adminConsole.list.table.pagination.previous', defaultMessage: 'Go to previous page'})}
                >
                    <i
                        className='icon icon-chevron-left'
                        aria-hidden='true'
                    />
                </button>
            )}
            {props.onNextPageClick && (
                <button
                    className='btn btn-icon btn-sm'
                    disabled={props.disableNextPage || props.isLoading}
                    onClick={props.onNextPageClick}
                    aria-label={formatMessage({id: 'adminConsole.list.table.pagination.next', defaultMessage: 'Go to next page'})}
                >
                    <i
                        className='icon icon-chevron-right'
                        aria-hidden='true'
                    />
                </button>
            )}
        </div>
    );
}
