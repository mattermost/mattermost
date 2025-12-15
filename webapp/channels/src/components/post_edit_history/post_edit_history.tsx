// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback, useEffect, useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {Post} from '@mattermost/types/posts';

import {getPostEditHistory} from 'mattermost-redux/actions/posts';
import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import Scrollbars from 'components/common/scrollbars';
import AlertIcon from 'components/common/svg_images_components/alert_svg';
import LoadingScreen from 'components/loading_screen';
import SearchResultsHeader from 'components/search_results_header';

import {isPopoutWindow, popoutPostEditHistory} from 'utils/popouts/popout_windows';

import EditedPostItem from './edited_post_item';

import type {PropsFromRedux} from './index';
import './post_edit_history.scss';

const PostEditHistory = ({
    channelDisplayName,
    originalPost,
}: PropsFromRedux) => {
    const [postEditHistory, setPostEditHistory] = useState<Post[]>([]);
    const [hasError, setHasError] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const dispatch = useDispatch();
    const scrollbars = useRef<HTMLDivElement>(null);
    const intl = useIntl();
    const {formatMessage} = intl;
    const currentTeam = useSelector(getCurrentTeam);
    const currentChannel = useSelector(getCurrentChannel);

    const newWindowHandler = useCallback(() => {
        if (originalPost?.id && currentTeam && currentChannel) {
            popoutPostEditHistory(intl, originalPost.id, currentTeam.name, currentChannel.name);
        }
    }, [intl, originalPost?.id, currentTeam, currentChannel]);

    const shouldShowPopoutButton = !isPopoutWindow() && originalPost?.id && currentTeam && currentChannel;
    const retrieveErrorHeading = formatMessage({
        id: 'post_info.edit.history.retrieveError',
        defaultMessage: 'Unable to load edit history',
    });
    const retrieveErrorSubheading = formatMessage({
        id: 'post_info.edit.history.retrieveErrorVerbose',
        defaultMessage: 'There was an error loading the history for this message. Check your network connection or try again later.',
    });

    useEffect(() => {
        const fetchPostEditHistory = async () => {
            setIsLoading(true);
            const result = await dispatch(getPostEditHistory(originalPost.id));
            if (result.data) {
                setPostEditHistory(result.data);
                setHasError(false);
            } else {
                setHasError(true);
                setPostEditHistory([]);
            }
            setIsLoading(false);
        };
        fetchPostEditHistory();
        scrollbars.current?.scrollTo({top: 0});
    }, [originalPost, dispatch]);

    useEffect(() => {
        setPostEditHistory([]);
        setHasError(false);
    }, [originalPost.id]);

    const title = formatMessage({
        id: 'search_header.title_edit.history',
        defaultMessage: 'Edit History',
    });

    const errorContainer: JSX.Element = (
        <div className='edit-post-history__error_container'>
            <div className='edit-post-history__error_item'>
                <AlertIcon
                    width={127}
                    height={127}
                />
                <p className='edit-post-history__error_heading'>
                    {retrieveErrorHeading}
                </p>
                <p className='edit-post-history__error_subheading'>
                    {retrieveErrorSubheading}
                </p>
            </div>
        </div>
    );

    if (isLoading && postEditHistory.length === 0) {
        return (
            <div
                id='rhsContainer'
                className='sidebar-right__body sidebar-right__edit-post-history'
            >
                <LoadingScreen
                    style={{
                        display: 'grid',
                        placeContent: 'center',
                        flex: '1',
                    }}
                />
            </div>
        );
    }

    const currentItem = (
        <EditedPostItem
            post={originalPost}
            key={originalPost.id}
            isCurrent={true}
        />
    );

    const postEditItems = [currentItem, ...postEditHistory.map((postEdited) => (
        <EditedPostItem
            key={postEdited.id}
            post={postEdited}
        />
    ))];

    return (
        <div
            id='rhsContainer'
            className='sidebar-right__body sidebar-right__edit-post-history'
        >
            <Scrollbars ref={scrollbars}>
                <SearchResultsHeader newWindowHandler={shouldShowPopoutButton ? newWindowHandler : undefined}>
                    <h2 id='rhsPanelTitle'>
                        {title}
                    </h2>
                    <div className='sidebar--right__title__channel'>{channelDisplayName}</div>
                </SearchResultsHeader>
                {hasError ? errorContainer : postEditItems}
            </Scrollbars>
        </div>
    );
};

export default memo(PostEditHistory);
