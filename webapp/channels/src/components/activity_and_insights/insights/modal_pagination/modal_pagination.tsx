// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback} from 'react';

type Props = {
    offset: number;
    hasNext: boolean;
    setOffset: (offset: number) => void;
}

const ModalPagination = ({offset, hasNext, setOffset}: Props) => {
    const incrementOffset = useCallback(() => {
        setOffset(offset + 1);
    }, [offset]);

    const decrementOffset = useCallback(() => {
        setOffset(offset - 1);
    }, [offset]);

    const pagination = useCallback(() => {
        let min = offset + 1;
        const max = min * 10;

        if (offset !== 0) {
            min = offset * 10;
        }

        return (
            <span className='pagination'>
                {`${min} - ${max}`}
            </span>
        );
    }, [offset]);

    return (
        <div className='pagination-buttons'>
            {pagination()}
            <button
                onClick={decrementOffset}
                disabled={offset === 0}
                className='icon pagination-button'
            >
                <i className='icon icon-chevron-left'/>
            </button>
            <button
                onClick={incrementOffset}
                disabled={!hasNext}
                className='icon pagination-button'
            >
                <i className='icon icon-chevron-right'/>
            </button>
        </div>
    );
};

export default memo(ModalPagination);
