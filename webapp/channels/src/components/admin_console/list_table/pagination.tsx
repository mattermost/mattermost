// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import PaginationButtons from 'components/common/pagination_buttons';

import type {TableMeta} from './list_table';

interface Props
    extends Pick<TableMeta,
    'onPreviousPageClick' |
    'onNextPageClick' |
    'disablePrevPage' |
    'disableNextPage'
    > {
    isLoading?: boolean;

    // The pager's path: `.previous--button`, `.next--button`.
    testIdScope?: string;
}

export function Pagination(props: Props) {
    return (
        <PaginationButtons
            className='paginationButtons'
            onPrevious={props.onPreviousPageClick}
            onNext={props.onNextPageClick}
            disablePrevious={props.disablePrevPage}
            disableNext={props.disableNextPage}
            isLoading={props.isLoading}
            previousButtonTestId={props.testIdScope ? `${props.testIdScope}.previous--button` : undefined}
            nextButtonTestId={props.testIdScope ? `${props.testIdScope}.next--button` : undefined}
        />
    );
}
