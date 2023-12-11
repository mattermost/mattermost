// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ReactNode} from 'react';

import './admin_console_list_table_pagination.scss';

interface Props {
    paginationDescription?: ReactNode;
    isFirstPage?: boolean;
    isLastPage?: boolean;
    onPreviousPageClick?: () => void;
    onNextPageClick?: () => void;
}

function AdminConsoleListTablePagination(props: Props) {
    return (
        <div className='adminConsoleListTablePagination'>
            <div>{props.paginationDescription}</div>
            <button
                className='btn btn-quaternary'
                disabled={props.isFirstPage}
                onClick={props.onPreviousPageClick}
            >
                <i className='icon icon-chevron-left'/>
            </button>
            <button
                className='btn btn-quaternary'
                disabled={props.isLastPage}
                onClick={props.onNextPageClick}
            >
                <i className='icon icon-chevron-right'/>
            </button>
        </div>
    );
}

export default AdminConsoleListTablePagination;
