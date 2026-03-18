// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {Post} from '@mattermost/types/posts';
import type {UserProfile} from '@mattermost/types/users';

import {General} from 'mattermost-redux/constants';
import {ensureString} from 'mattermost-redux/utils/post_utils';

import FileAttachmentListContainer from 'components/file_attachment_list';
import PostHeaderTranslateIcon from 'components/post/post_header_translate_icon';
import PriorityLabel from 'components/post_priority/post_priority_label';
import AiGeneratedIndicator from 'components/post_view/ai_generated_indicator/ai_generated_indicator';
import PostAttachmentOpenGraph from 'components/post_view/post_attachment_opengraph';
import PostMessageView from 'components/post_view/post_message_view';
import Timestamp from 'components/timestamp';
import UserProfileComponent from 'components/user_profile';

import * as PostUtils from 'utils/post_utils';
import {getPostTranslation} from 'utils/post_utils';

import PreviewPostAvatar from './avatar/avatar';

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
    overrideGenerateFileDownloadUrl?: (fileId: string) => string;
    disableActions?: boolean;
    actions: {
        toggleEmbedVisibility: (id: string) => void;
    };
    isChannelAutotranslated: boolean;
};

const PostMessagePreview = (props: Props) => {
    const {currentTeamUrl, channelDisplayName, user, previewPost, metadata, isEmbedVisible, compactDisplay, preventClickAction, previewFooterMessage, handleFileDropdownOpened, isPostPriorityEnabled, overrideGenerateFileDownloadUrl, disableActions, isChannelAutotranslated} = props;
    const {locale} = useIntl();
    const toggleEmbedVisibility = () => {
        if (previewPost) {
            props.actions.toggleEmbedVisibility(previewPost.id);
        }
    };

    if (!previewPost) {
        return null;
    }

    let fileAttachmentPreview = null;

    if (((previewPost.file_ids && previewPost.file_ids.length > 0) || (previewPost.filenames && previewPost.filenames.length > 0))) {
        fileAttachmentPreview = (
            <FileAttachmentListContainer
                post={previewPost}
                compactDisplay={compactDisplay}
                isInPermalink={true}
                handleFileDropdownOpened={handleFileDropdownOpened}
                usePostAsSource={props.usePostAsSource}
                overrideGenerateFileDownloadUrl={overrideGenerateFileDownloadUrl}
                disableActions={disableActions}
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

    const overwriteName = ensureString(previewPost.props?.override_username);

    const translation = getPostTranslation(previewPost, locale);

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
                                {
                                    user &&
                                    <PreviewPostAvatar
                                        post={previewPost}
                                        user={user}
                                        enablePostIconOverride={props.enablePostIconOverride}
                                        hasImageProxy={props.hasImageProxy}
                                    />
                                }
                            </span>
                        </div>
                    </div>
                    <div className={classNames('col col__name', 'permalink--username')}>
                        <UserProfileComponent
                            userId={user?.id ?? ''}
                            disablePopover={true}
                            overwriteName={overwriteName}
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
                        {PostUtils.hasAiGeneratedMetadata(previewPost) && (
                            <AiGeneratedIndicator
                                userId={previewPost.props.ai_generated_by as string}
                                username={previewPost.props.ai_generated_by_username as string}
                                postAuthorId={previewPost.user_id}
                            />
                        )}
                        {isChannelAutotranslated && (
                            <PostHeaderTranslateIcon
                                postId={previewPost.id}
                                translationState={translation?.state}
                                postType={previewPost.type}
                            />
                        )}
                    </div>
                </div>
                <PostMessageView
                    post={previewPost}
                    overflowType='ellipsis'
                    maxHeight={105}
                    userLanguage={locale}
                    isChannelAutotranslated={isChannelAutotranslated}
                />
                {urlPreview}
                {fileAttachmentPreview}
                {previewFooter}
            </div>
        </PostAttachmentContainer>
    );
};

export default PostMessagePreview;
