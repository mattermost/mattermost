// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {CheckCircleIcon, CheckCircleOutlineIcon} from '@mattermost/compass-icons/components';
import type {Post} from '@mattermost/types/posts';

import {resolvePageComment, unresolvePageComment} from 'actions/pages';
import {closeModal, openModal} from 'actions/views/modals';
import {isPageCommentResolved} from 'selectors/wiki_posts';

import InfoToast from 'components/info_toast/info_toast';

import {ModalIdentifiers} from 'utils/constants';
import {isPageComment} from 'utils/page_utils';

import type {GlobalState} from 'types/store';

type Props = {
    post: Post;
};

// Quick-action Resolve / Unresolve button shown in the post action bar for page comments,
// alongside reactions and the dot menu. Bug B7: resolving was previously only reachable
// through the 3-dot overflow menu.
const PageCommentResolveIcon = ({post}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const isResolved = useSelector((state: GlobalState) => {
        const latestPost = (state.entities as any).pages?.commentsById?.[post.id] ?? post;
        return isPageCommentResolved(latestPost);
    });

    const wikiId = post.props?.wiki_id as string | undefined;
    const pageId = post.props?.page_id as string | undefined;

    const onClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!wikiId || !pageId) {
            return;
        }

        // B6: surface a 5-second toast with an Undo so the resolve action has visible
        // confirmation. The toast's `undo` reverses the state by dispatching the inverse.
        const wasResolved = isResolved;
        if (wasResolved) {
            dispatch(unresolvePageComment(wikiId, pageId, post.id));
        } else {
            dispatch(resolvePageComment(wikiId, pageId, post.id));
        }

        const toastMessage = wasResolved ?
            formatMessage({id: 'post_info.unresolve_comment.toast', defaultMessage: 'Comment reopened'}) :
            formatMessage({id: 'post_info.resolve_comment.toast', defaultMessage: 'Comment resolved'});

        dispatch(openModal({
            modalId: ModalIdentifiers.INFO_TOAST,
            dialogType: InfoToast,
            dialogProps: {
                content: {
                    message: toastMessage,
                    undo: () => {
                        // Reverse: if we resolved, unresolve on undo (and vice versa).
                        if (wasResolved) {
                            dispatch(resolvePageComment(wikiId, pageId, post.id));
                        } else {
                            dispatch(unresolvePageComment(wikiId, pageId, post.id));
                        }
                    },
                },
                position: 'bottom-center',
                onExited: () => dispatch(closeModal(ModalIdentifiers.INFO_TOAST)),
            },
        }));
    }, [dispatch, formatMessage, isResolved, post.id, wikiId, pageId]);

    if (!isPageComment(post) || !wikiId || !pageId) {
        return null;
    }

    const labelId = isResolved ? 'post_info.unresolve_comment' : 'post_info.resolve_comment';
    const labelDefault = isResolved ? 'Unresolve' : 'Resolve';
    const ariaLabel = formatMessage({id: labelId, defaultMessage: labelDefault});

    return (
        <button
            type='button'
            aria-label={ariaLabel}
            title={ariaLabel}
            data-testid={`resolve-comment-${post.id}`}
            className={`post-menu__item color--link style--none ${isResolved ? 'post-menu__item--resolved' : ''}`}
            onClick={onClick}
        >
            {isResolved ? <CheckCircleIcon size={16}/> : <CheckCircleOutlineIcon size={16}/>}
        </button>
    );
};

export default PageCommentResolveIcon;
