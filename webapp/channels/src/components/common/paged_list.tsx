// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import debounce from 'lodash/debounce';
import React, {forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef} from 'react';
import {FormattedMessage} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';

import Scrollbars from 'components/common/scrollbars';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import './paged_list.scss';

const LOAD_MORE_BUFFER = 30;
const LOAD_MORE_DEBOUNCE = 100;

type Props = {
    children: React.ReactNode;

    /** Whether another page can be loaded. The loading spinner is shown at the end of the list while true. */
    hasMore: boolean;

    /** Whether the next page is being fetched, which holds off further requests. */
    isLoadingMore: boolean;

    onLoadMore: () => void;

    /** Keep loading pages until the list overflows the viewport, for lists whose pages can come back short or empty. */
    loadUntilFull?: boolean;

    /** Why the last page failed to load. Shown with a retry button in place of the spinner, and stops automatic loading until cleared. */
    loadMoreError?: React.ReactNode;
};

const PagedList = forwardRef<HTMLDivElement, Props>(({
    children,
    hasMore,
    isLoadingMore,
    onLoadMore,
    loadUntilFull = false,
    loadMoreError,
}, ref) => {
    const scrollbars = useRef<HTMLDivElement>(null);
    useImperativeHandle(ref, () => scrollbars.current as HTMLDivElement, []);
    const loader = useRef<HTMLDivElement>(null);

    const onLoadMoreRef = useRef(onLoadMore);
    onLoadMoreRef.current = onLoadMore;

    const loadMore = useMemo(() => debounce(() => onLoadMoreRef.current(), LOAD_MORE_DEBOUNCE), []);
    useEffect(() => () => loadMore.cancel(), [loadMore]);

    // Measured from the top of the loading spinner, so that seeing the spinner is enough to load the next page.
    const loadMoreIfNearEnd = () => {
        if (!hasMore || isLoadingMore || loadMoreError || !scrollbars.current) {
            return;
        }

        const {scrollTop, clientHeight, scrollHeight} = scrollbars.current;
        const loaderHeight = loader.current?.offsetHeight ?? 0;
        if (scrollTop + clientHeight + LOAD_MORE_BUFFER >= scrollHeight - loaderHeight) {
            loadMore();
        }
    };
    const loadMoreIfNearEndRef = useRef(loadMoreIfNearEnd);
    loadMoreIfNearEndRef.current = loadMoreIfNearEnd;
    const onScroll = useCallback(() => loadMoreIfNearEndRef.current(), []);

    useEffect(() => {
        const scrollable = scrollbars.current;
        if (!loadUntilFull || !scrollable) {
            return undefined;
        }

        const observer = new ResizeObserver(() => loadMoreIfNearEndRef.current());
        observer.observe(scrollable);
        for (const content of Array.from(scrollable.children)) {
            observer.observe(content);
        }

        return () => observer.disconnect();
    }, [loadUntilFull]);

    return (
        <Scrollbars
            ref={scrollbars}
            color='--center-channel-color-rgb'
            onScroll={onScroll}
        >
            {children}
            {hasMore && loadMoreError && (
                <div
                    className='PagedList__error'
                    role='alert'
                >
                    <span>{loadMoreError}</span>
                    <Button
                        type='button'
                        emphasis='tertiary'
                        size='sm'
                        onClick={() => onLoadMoreRef.current()}
                    >
                        <FormattedMessage
                            id='paged_list.retry'
                            defaultMessage='Try again'
                        />
                    </Button>
                </div>
            )}
            {hasMore && !loadMoreError && (
                <div
                    ref={loader}
                    className='loading-screen'
                >
                    <div className='loading__content'>
                        <LoadingSpinner/>
                    </div>
                </div>
            )}
        </Scrollbars>
    );
});
PagedList.displayName = 'PagedList';

export default PagedList;
