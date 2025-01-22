// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo, useCallback, useState} from 'react';
import {defineMessages, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {CheckIcon} from '@mattermost/compass-icons/components';
import type {Post} from '@mattermost/types/posts';

import {getPostEditHistory, restorePostVersion} from 'mattermost-redux/actions/posts';
import type {Theme} from 'mattermost-redux/selectors/entities/preferences';
import {ensureString} from 'mattermost-redux/utils/post_utils';

import {removeDraft} from 'actions/views/drafts';
import {getConnectionId} from 'selectors/general';

import CompassThemeProvider from 'components/compass_theme_provider/compass_theme_provider';
import FileAttachmentListContainer from 'components/file_attachment_list';
import InfoToast from 'components/info_toast/info_toast';
import PostAriaLabelDiv from 'components/post_view/post_aria_label_div';
import PostMessageContainer from 'components/post_view/post_message_view';
import Timestamp, {RelativeRanges} from 'components/timestamp';
import UserProfileComponent from 'components/user_profile';
import Avatar from 'components/widgets/users/avatar';
import WithTooltip from 'components/with_tooltip';

import {ModalIdentifiers, StoragePrefixes} from 'utils/constants';
import {imageURLForUser} from 'utils/utils';

import RestorePostModal from '../restore_post_modal';

import './edited_post_items.scss';

import type {PropsFromRedux} from './index';

const DATE_RANGES = [
    RelativeRanges.TODAY_TITLE_CASE,
    RelativeRanges.YESTERDAY_TITLE_CASE,
];

const itemMessages = defineMessages({
    helpText: {
        id: 'post_info.edit.restore',
        defaultMessage: 'Restore this version',
    },
    currentVersionText: {
        id: 'post_info.edit.current_version',
        defaultMessage: 'Current Version',
    },
    ariaLabelMessage: {
        id: 'post_info.edit.aria_label',
        defaultMessage: 'Select to restore an old message.',
    },
});

export type Props = PropsFromRedux & {
    post: Post;
    isCurrent?: boolean;
    theme: Theme;
}

const EditedPostItem = ({post, isCurrent = false, postCurrentVersion, theme, actions}: Props) => {
    const {formatMessage} = useIntl();
    const [open, setOpen] = useState(isCurrent);

    const dispatch = useDispatch();

    const connectionId = useSelector(getConnectionId);

    const openRestorePostModal = useCallback((e) => {
        // this prevents history item from
        // collapsing and closing when clicking on restore button
        e.stopPropagation();

        const restorePostModalData = {
            modalId: ModalIdentifiers.RESTORE_POST_MODAL,
            dialogType: RestorePostModal,
            dialogProps: {
                post,
                postHeader,
                actions: {
                    handleRestore,
                },
            },
        };

        actions.openModal(restorePostModalData);
    }, [actions, post]);

    const togglePost = () => {
        setOpen((prevState) => !prevState);
    };

    if (!post) {
        return null;
    }

    const showInfoTooltip = () => {
        const infoToastModalData = {
            modalId: ModalIdentifiers.INFO_TOAST,
            dialogType: InfoToast,
            dialogProps: {
                content: {
                    icon: <CheckIcon size={18}/>,
                    message: 'Restored Message',
                    undo: handleUndo,
                },
            },
        };

        actions.openModal(infoToastModalData);
    };

    const handleRestore = async () => {
        if (!postCurrentVersion || !post) {
            actions.closeRightHandSide();
            return;
        }

        const result = await dispatch(restorePostVersion(post.original_id, post.id, connectionId));
        if (result.data) {
            actions.closeRightHandSide();
            showInfoTooltip();
        }

        const key = StoragePrefixes.EDIT_DRAFT + post.original_id;
        dispatch(removeDraft(key, post.channel_id, post.root_id));
    };

    const handleUndo = async () => {
        if (!postCurrentVersion) {
            actions.closeRightHandSide();
            return;
        }

        // To undo a recent restore, you need to restore the previous version of the post right before this restore.
        // That would be the first history item in post's edit history as it is the most recent edit
        // and edit history is sorted from most recent first to oldest.
        const result = await dispatch(getPostEditHistory(post.original_id));
        if (!result.data || result.data.length === 0) {
            return;
        }

        const previousPostVersion = result.data[0];
        await dispatch(restorePostVersion(previousPostVersion.original_id, previousPostVersion.id, connectionId));
    };

    const currentVersionIndicator = isCurrent ? (
        <div className='edit-post-history__current__indicator'>
            {formatMessage(itemMessages.currentVersionText)}
        </div>
    ) : null;

    const profileSrc = imageURLForUser(post.user_id);

    const overwriteName = ensureString(post.props?.override_username);
    const postHeader = (
        <div className='edit-post-history__header'>
            <span className='profile-icon'>
                <Avatar
                    size={'sm'}
                    url={profileSrc}
                    className={'avatar-post-preview'}
                />
            </span>
            <div className={'edit-post-history__header__username'}>
                <UserProfileComponent
                    userId={post.user_id}
                    disablePopover={true}
                    overwriteName={overwriteName}
                />
            </div>
        </div>
    );

    const message = (
        <PostMessageContainer
            post={post}
            isRHS={true}
            showPostEditedIndicator={false}
        />
    );

    const isFileDeleted = post.delete_at > 0;

    const messageContainer = (
        <div className='edit-post-history__content_container'>
            {postHeader}
            <div className='post__content'>
                <div className='search-item-snippet post__body'>
                    {message}
                </div>
            </div>
            <FileAttachmentListContainer
                post={post}
                isEditHistory={isFileDeleted}
                disableDownload={isFileDeleted}
                disableActions={isFileDeleted}
            />
        </div>
    );

    const restoreButton = isCurrent ? null : (
        <WithTooltip
            title={formatMessage(itemMessages.helpText)}
        >
            <button
                className='edit-post-history__icon__button restore-icon'
                onClick={openRestorePostModal}
                aria-label={formatMessage(itemMessages.ariaLabelMessage)}
            >
                <i className={'icon icon-restore'}/>
            </button>
        </WithTooltip>
    );

    const postContainerClass = classNames('edit-post-history__container', {'edit-post-history__container__background': open});
    const timeStampValue = post.edit_at === 0 ? post.create_at : post.edit_at;

    return (
        <CompassThemeProvider theme={theme}>
            <div
                className={postContainerClass}
                onClick={togglePost}
            >
                <PostAriaLabelDiv
                    className={'a11y__section post'}
                    id={'searchResult_' + post.id}
                    post={post}
                >
                    <div
                        className='edit-post-history__title__container'
                    >
                        <div className='edit-post-history__date__badge__container'>
                            <button
                                aria-label='Toggle to see an old message.'
                                className='edit-post-history__icon__button toggleCollapseButton'
                            >
                                <i className={`icon ${open ? 'icon-chevron-down' : 'icon-chevron-right'}`}/>
                            </button>
                            <span className='edit-post-history__date'>
                                <Timestamp
                                    value={timeStampValue}
                                    ranges={DATE_RANGES}
                                />
                            </span>
                            {currentVersionIndicator}
                        </div>
                        {restoreButton}
                    </div>
                    {open && messageContainer}
                </PostAriaLabelDiv>
            </div>
        </CompassThemeProvider>
    );
};

export default memo(EditedPostItem);
