// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {matchPath, useHistory} from 'react-router-dom';

import {getPost} from 'mattermost-redux/selectors/entities/posts';
import {isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {isTeamSameWithCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {focusPost} from 'components/permalink_view/actions';

import {GlobalState} from 'types/store';

export type Props = {
    className?: string;
    children?: JSX.Element;
    preventClickAction?: boolean;
    link: string;
};

type LinkParams = {
    postId: string;
    teamName: string;
}

const getTeamAndPostIdFromLink = (link: string) => {
    const match = matchPath<LinkParams>(link, {path: '/:teamName/pl/:postId'});
    return match?.params;
};

const PostAttachmentContainer = (props: Props) => {
    const {children, className, link, preventClickAction} = props;
    const history = useHistory();

    const params = getTeamAndPostIdFromLink(link);

    const dispatch = useDispatch();

    const currentUserId = useSelector(getCurrentUserId);
    const shouldFocusPostWithoutRedirect = useSelector((state: GlobalState) => isTeamSameWithCurrentTeam(state, params?.teamName ?? ''));
    const post = useSelector((state: GlobalState) => getPost(state, params?.postId ?? ''));
    const crtEnabled = useSelector(isCollapsedThreadsEnabled);

    const handleOnClick = useCallback((e) => {
        const {tagName} = e.target;
        e.stopPropagation();
        const elements = ['A', 'IMG', 'BUTTON', 'I'];

        if (
            !elements.includes(tagName) &&
                e.target.getAttribute('role') !== 'button' &&
                e.target.className !== `attachment attachment--${className}`
        ) {
            const classNames = [
                'icon icon-menu-down',
                'icon icon-menu-right',
                'post-image',
                'file-icon',
            ];

            if (params && shouldFocusPostWithoutRedirect && crtEnabled && post && post.root_id) {
                dispatch(focusPost(params.postId, link, currentUserId, {skipRedirectReplyPermalink: true}));
                return;
            }
            if (!classNames.some((className) => e.target.className.includes(className)) && e.target.id !== 'image-name-text') {
                history.push(link);
            }
        }
    }, [className, crtEnabled, dispatch, history, link, params, post, shouldFocusPostWithoutRedirect, currentUserId]);
    return (
        <div
            className={`attachment attachment--${className}`}
            role={preventClickAction ? undefined : 'button'}
            onClick={preventClickAction ? undefined : handleOnClick}
        >
            <div
                className={`attachment__content attachment__content--${className}`}
            >
                <div
                    className={`clearfix attachment__container attachment__container--${className}`}
                >
                    <div
                        className={`attachment__body__wrap attachment__body__wrap--${className}`}
                    >
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PostAttachmentContainer;
