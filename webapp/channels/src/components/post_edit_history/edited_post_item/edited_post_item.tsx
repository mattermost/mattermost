// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback, useState} from 'react';
import {defineMessages, useIntl} from 'react-intl';

import classNames from 'classnames';

import IconButton from '@mattermost/compass-components/components/icon-button'; // eslint-disable-line no-restricted-imports
import {CheckIcon} from '@mattermost/compass-icons/components';
import type {Post} from '@mattermost/types/posts';

import type {Theme} from 'mattermost-redux/selectors/entities/preferences';

import CompassThemeProvider from 'components/compass_theme_provider/compass_theme_provider';
import InfoToast from 'components/info_toast/info_toast';
import OverlayTrigger from 'components/overlay_trigger';
import PostAriaLabelDiv from 'components/post_view/post_aria_label_div';
import PostMessageContainer from 'components/post_view/post_message_view';
import Timestamp, {RelativeRanges} from 'components/timestamp';
import Tooltip from 'components/tooltip';
import UserProfileComponent from 'components/user_profile';
import Avatar from 'components/widgets/users/avatar';

import Constants, {ModalIdentifiers} from 'utils/constants';
import {imageURLForUser} from 'utils/utils';

import RestorePostModal from '../restore_post_modal';

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

    const openRestorePostModal = useCallback(() => {
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

    const togglePost = () => setOpen((prevState) => !prevState);

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
        if (!postCurrentVersion || !post || postCurrentVersion.message === post.message) {
            actions.closeRightHandSide();
            return;
        }

        const updatedPost = {
            message: post.message,
            id: postCurrentVersion.id,
            channel_id: postCurrentVersion.channel_id,
        };

        const result = await actions.editPost(updatedPost as Post);
        if (result.data) {
            actions.closeRightHandSide();
            showInfoTooltip();
        }
    };

    const handleUndo = async () => {
        if (!postCurrentVersion) {
            actions.closeRightHandSide();
            return;
        }

        await actions.editPost(postCurrentVersion);
    };

    const currentVersionIndicator = isCurrent ? (
        <div className='edit-post-history__current__indicator'>
            {formatMessage(itemMessages.currentVersionText)}
        </div>
    ) : null;

    const profileSrc = imageURLForUser(post.user_id);

    const overwriteName = post.props ? post.props.override_username : '';
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
                    hasMention={true}
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

    const messageContainer = (
        <div className='edit-post-history__content_container'>
            {postHeader}
            <div className='post__content'>
                <div className='search-item-snippet post__body'>
                    {message}
                </div>
            </div>
        </div>
    );

    const tooltip = (
        <Tooltip
            id='editPostRestoreTooltip'
            className='hidden-xs'
        >
            {formatMessage(itemMessages.helpText)}
        </Tooltip>
    );

    const restoreButton = isCurrent ? null : (
        <OverlayTrigger
            trigger={['hover', 'focus']}
            delayShow={Constants.OVERLAY_TIME_DELAY}
            placement='left'
            overlay={tooltip}
        >
            <IconButton
                className='edit-post-history__icon__button restore-icon'
                size={'sm'}
                icon={'restore'}
                onClick={openRestorePostModal}
                compact={true}
                aria-label={formatMessage(itemMessages.ariaLabelMessage)}
            />
        </OverlayTrigger>
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
                        aria-hidden='true'
                    >
                        <div className='edit-post-history__date__badge__container'>
                            <IconButton
                                size={'sm'}
                                icon={open ? 'chevron-down' : 'chevron-right'}
                                compact={true}
                                aria-label='Toggle to see an old message.'
                                className='edit-post-history__icon__button'
                            />
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
