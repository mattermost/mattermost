// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import styled from 'styled-components';

const PaginationRowDiv = styled.div`
    margin: 10px 0 20px;
    font-size: 14px;
    display: grid;
    align-items: center;
    grid-template-columns: minmax(20rem, min-content) auto minmax(20rem, min-content);
    justify-content: space-between;
    padding: 0 2px;
`;

const Count = styled.span`
    color: rgba(var(--center-channel-color-rgb), 0.56);
    white-space: nowrap;
`;

const Button = styled.button`
    font-weight: bold;
`;

interface Props {
    page: number;
    perPage: number;
    totalCount: number;
    setPage: (page: number) => void;
}

export function PaginationRow(props: Props) {
    function onPrevPage() {
        props.setPage(Math.max(props.page - 1, 0));
    }

    function onNextPage() {
        props.setPage(props.page + 1);
    }

    const showNextPage = ((props.page + 1) * props.perPage) < props.totalCount;

    const start = props.page * props.perPage;
    const to = Math.min(start + props.perPage, props.totalCount);
    const from = props.totalCount === 0 ? 0 : start + 1;

    return (
        <PaginationRowDiv>
            {props.page > 0 && (
                <Button
                    className='btn btn-link'
                    onClick={onPrevPage}
                    css={`
                        grid-column: 1;
                        justify-self: start;
                    `}
                >
                    <FormattedMessage defaultMessage='Previous'/>
                </Button>
            )}
            <Count
                css={`
                    grid-column: 2;
                `}
            >
                <FormattedMessage
                    defaultMessage='{from, number}–{to, number} of {total, number} total'
                    values={{from, to, total: props.totalCount}}
                />
            </Count>
            {showNextPage && (
                <Button
                    className='btn btn-link'
                    onClick={onNextPage}
                    css={`
                        grid-column: 3;
                        justify-self: end;
                    `}
                >
                    <FormattedMessage defaultMessage='Next'/>
                </Button>
            )}
        </PaginationRowDiv>
    );
}
