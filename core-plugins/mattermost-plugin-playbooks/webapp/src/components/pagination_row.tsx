// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import styled from 'styled-components';

const PaginationRowDiv = styled.div`
    display: grid;
    align-items: center;
    justify-content: space-between;
    margin: 10px 16px 20px;
    font-size: 14px;
    grid-template-columns: minmax(20rem, min-content) auto minmax(20rem, min-content);
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
                    style={{
                        gridColumn: 1,
                        justifySelf: 'start',
                    }}
                >
                    <FormattedMessage defaultMessage='Previous'/>
                </Button>
            )}
            <Count
                style={{
                    gridColumn: 2,
                }}
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
                    style={{
                        gridColumn: 3,
                        justifySelf: 'end',
                    }}
                >
                    <FormattedMessage defaultMessage='Next'/>
                </Button>
            )}
        </PaginationRowDiv>
    );
}
