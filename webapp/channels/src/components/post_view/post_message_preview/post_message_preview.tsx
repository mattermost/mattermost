// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {Post} from '@mattermost/types/posts';
import type {UserProfile} from '@mattermost/types/users';

import {General} from 'mattermost-redux/constants';

import FileAttachmentListContainer from 'components/file_attachment_list';
import PriorityLabel from 'components/post_priority/post_priority_label';
import PostAttachmentOpenGraph from 'components/post_view/post_attachment_opengraph';
import PostMessageView from 'components/post_view/post_message_view';
import Timestamp from 'components/timestamp';
import UserProfileComponent from 'components/user_profile';
import MattermostLogo from 'components/widgets/icons/mattermost_logo';
import Avatar from 'components/widgets/users/avatar';

import {Constants} from 'utils/constants';
import * as PostUtils from 'utils/post_utils';
import * as Utils from 'utils/utils';

import PostAttachmentContainer from '../post_attachment_container/post_attachment_container';

import type {OwnProps} from './index';

export type Props = OwnProps & {
    previewPost?: Post;
    currentTeamUrl: string;
    channelDisplayName?: string;
    user: UserProfile | null;
    hasImageProxy: boolean;
    enablePostIconOverride: boolean;
    isEmbedVisible: boolean;
    compactDisplay: boolean;
    isPostPriorityEnabled: boolean;
    handleFileDropdownOpened?: (open: boolean) => void;
    actions: {
        toggleEmbedVisibility: (id: string) => void;
    };
};

const PostMessagePreview = (props: Props) => {
    const {currentTeamUrl, channelDisplayName, user, previewPost, metadata, isEmbedVisible, compactDisplay, preventClickAction, previewFooterMessage, handleFileDropdownOpened, isPostPriorityEnabled} = props;

    const toggleEmbedVisibility = () => {
        if (previewPost) {
            props.actions.toggleEmbedVisibility(previewPost.id);
        }
    };

    const getPostIconURL = (defaultURL: string, fromAutoResponder: boolean, fromWebhook: boolean): string => {
        const {enablePostIconOverride, hasImageProxy, previewPost} = props;
        const postProps = previewPost?.props;
        let postIconOverrideURL = '';
        let useUserIcon = '';
        if (postProps) {
            postIconOverrideURL = postProps.override_icon_url;
            useUserIcon = postProps.use_user_icon;
        }

        if (!fromAutoResponder && fromWebhook && !useUserIcon && enablePostIconOverride) {
            if (postIconOverrideURL && postIconOverrideURL !== '') {
                return PostUtils.getImageSrc(postIconOverrideURL, hasImageProxy);
            }
            return Constants.DEFAULT_WEBHOOK_LOGO;
        }

        return defaultURL;
    };

    if (!previewPost) {
        return null;
    }

    const isBot = Boolean(user && user.is_bot);
    const isSystemMessage = PostUtils.isSystemMessage(previewPost);
    const fromWebhook = PostUtils.isFromWebhook(previewPost);
    const fromAutoResponder = PostUtils.fromAutoResponder(previewPost);
    const profileSrc = Utils.imageURLForUser(user?.id ?? '');
    const src = getPostIconURL(profileSrc, fromAutoResponder, fromWebhook);

    let avatar = (
        <Avatar
            size={'sm'}
            url={src}
            className={'avatar-post-preview'}
        />
    );
    if (isSystemMessage && !fromWebhook && !isBot) {
        avatar = (<MattermostLogo className='icon'/>);
    } else if (user?.id) {
        avatar = (
            <Avatar
                username={user.username}
                size={'sm'}
                url={src}
                className={'avatar-post-preview'}
            />
        );
    }

    let fileAttachmentPreview = null;

    if (((previewPost.file_ids && previewPost.file_ids.length > 0) || (previewPost.filenames && previewPost.filenames.length > 0))) {
        fileAttachmentPreview = (
            <FileAttachmentListContainer
                post={previewPost}
                compactDisplay={compactDisplay}
                isInPermalink={true}
                handleFileDropdownOpened={handleFileDropdownOpened}
            />
        );
    }

    let urlPreview = null;

    if (previewPost && previewPost.metadata && previewPost.metadata.embeds) {
        const embed = previewPost.metadata.embeds[0];

        if (embed && embed.type === 'opengraph') {
            urlPreview = (
                <PostAttachmentOpenGraph
                    postId={previewPost.id}
                    link={embed.url}
                    isEmbedVisible={isEmbedVisible}
                    post={previewPost}
                    toggleEmbedVisibility={toggleEmbedVisibility}
                    isInPermalink={true}
                />
            );
        }
    }

    let teamUrl = `/${metadata.team_name}`;
    if (metadata.channel_type === General.DM_CHANNEL || metadata.channel_type === General.GM_CHANNEL) {
        teamUrl = currentTeamUrl;
    }

    const previewFooter = channelDisplayName || previewFooterMessage ? (
        <div className='post__preview-footer'>
            <p>
                {previewFooterMessage || (
                    <FormattedMessage
                        id='post_message_preview.channel'
                        defaultMessage='Only visible to users in ~{channel}'
                        values={{
                            channel: channelDisplayName,
                        }}
                    />
                )}
            </p>
        </div>
    ) : null;

    return (
        <PostAttachmentContainer
            className='permalink'
            link={`${teamUrl}/pl/${metadata.post_id}`}
            preventClickAction={preventClickAction}
        >
            <div className='post-preview'>
                <div className='post-preview__header'>
                    <div className='col col__name'>
                        <div className='post__img'>
                            <span className='profile-icon'>
                                {avatar}
                            </span>
                        </div>
                    </div>
                    <div className={classNames('col col__name', 'permalink--username')}>
                        <UserProfileComponent
                            userId={user?.id ?? ''}
                            disablePopover={true}
                            overwriteName={previewPost.props?.override_username || ''}
                        />
                    </div>
                    <div className='col d-flex align-items-center'>
                        <Timestamp
                            value={previewPost.create_at}
                            units={[
                                'now',
                                'minute',
                                'hour',
                                'day',
                            ]}
                            useTime={false}
                            day={'numeric'}
                            className='post-preview__time'
                        />
                        {previewPost.metadata?.priority && isPostPriorityEnabled && (
                            <span className='d-flex mr-2 ml-1'>
                                <PriorityLabel priority={previewPost.metadata.priority.priority}/>
                            </span>
                        )}
                    </div>
                </div>
                <PostMessageView
                    post={previewPost}
                    overflowType='ellipsis'
                    maxHeight={105}
                />
                {urlPreview}
                {fileAttachmentPreview}
                {previewFooter}
            </div>
        </PostAttachmentContainer>
    );
};

export default PostMessagePreview;
