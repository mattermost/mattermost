// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import memoize from 'memoize-one';
import React from 'react';

import type {Post} from '@mattermost/types/posts';

import {Posts} from 'mattermost-redux/constants';

import Markdown from 'components/markdown';
import {DataSpillageReport} from 'components/post_view/data_spillage_report/data_spillage_report';

import {PostTypes} from 'utils/constants';
import {isChannelNamesMap, type TextFormattingOptions} from 'utils/text_formatting';

import {renderReminderSystemBotMessage, renderSystemMessage, renderWranglerSystemMessage} from './system_message_helpers';

import {type PropsFromRedux} from './index';

export type OwnProps = {

    /**
     * Any extra props that should be passed into the image component
     */
    imageProps?: Record<string, unknown>;

    /**
     * The post text to be rendered
     */
    message: string;

    /**
     * The optional post for which this message is being rendered
     */
    post?: Post;
    channelId: string;

    /**
     * Whether or not to render the post edited indicator
     * @default true
     */
    showPostEditedIndicator?: boolean;
    options?: TextFormattingOptions;

    /**
     * Whether or not to render text emoticons (:D) as emojis
     */
    renderEmoticonsAsEmoji?: boolean;

    isRHS?: boolean;

    /** Permalink previews and similar read-only surfaces. */
    disableInteractions?: boolean;
};

type Props = PropsFromRedux & OwnProps;

export default class PostMarkdown extends React.PureComponent<Props> {
    static defaultProps = {
        pluginHooks: [],
        options: {},
        showPostEditedIndicator: true,
    };

    getOptions = memoize(
        (options?: TextFormattingOptions, disableGroupHighlight?: boolean, mentionHighlight?: boolean, editedAt?: number, renderEmoticonsAsEmoji?: boolean) => {
            return {
                ...options,
                disableGroupHighlight,
                mentionHighlight,
                editedAt,
                renderEmoticonsAsEmoji,
            };
        });

    render() {
        let message = this.props.message;

        if (this.props.post) {
            const renderedSystemMessage = this.props.channel ? renderSystemMessage(this.props.post,
                this.props.currentTeam?.name ?? '',
                this.props.channel,
                this.props.hideGuestTags,
                this.props.isUserCanManageMembers,
                this.props.isMilitaryTime,
                this.props.timezone) : null;
            if (renderedSystemMessage) {
                return <div>{renderedSystemMessage}</div>;
            }
        }

        if (this.props.post && this.props.post.type === Posts.POST_TYPES.REMINDER) {
            if (!this.props.currentTeam) {
                return null;
            }
            const renderedSystemBotMessage = renderReminderSystemBotMessage(this.props.post, this.props.currentTeam);
            return <div>{renderedSystemBotMessage}</div>;
        }

        if (this.props.post && this.props.post.type === Posts.POST_TYPES.WRANGLER) {
            const renderedWranglerMessage = renderWranglerSystemMessage(this.props.post);
            return <div>{renderedWranglerMessage}</div>;
        }

        if (this.props.post && this.props.post.type === PostTypes.CUSTOM_DATA_SPILLAGE_REPORT) {
            return (
                <div>
                    <DataSpillageReport
                        post={this.props.post}
                        isRHS={this.props.isRHS}
                    />
                </div>
            );
        }

        const channelNamesMap = isChannelNamesMap(this.props.post?.props?.channel_mentions) ? this.props.post?.props?.channel_mentions : undefined;

        this.props.pluginHooks?.forEach((o) => {
            if (o && o.hook && this.props.post) {
                message = o.hook(this.props.post, message);
            }
        });

        let mentionHighlight = this.props.options?.mentionHighlight;
        if (this.props.post && this.props.post.props) {
            mentionHighlight = !this.props.post.props.mentionHighlightDisabled;
        }

        const isBot = this.props.post?.props?.from_bot === 'true';
        const isWebhook = this.props.post?.props?.from_webhook === 'true';
        const isPlugin = this.props.post?.props?.from_plugin === 'true';

        const allowInlineActions = !this.props.disableInteractions && (isBot || isWebhook || isPlugin);
        const postProps = this.props.post?.props as Record<string, unknown> | undefined;
        const mmBlocksActionsCookie = typeof postProps?.mm_blocks_actions === 'string' ?
            postProps.mm_blocks_actions :
            undefined;
        const integrationFormat = mmBlocksActionsCookie ? 'mm_block' : undefined;

        const options = this.getOptions(
            this.props.options,
            this.props.post?.props?.disable_group_highlight === true,
            mentionHighlight,
            this.props.post?.edit_at,
            this.props?.renderEmoticonsAsEmoji,
        );

        let highlightKeys;
        if (!this.props.isEnterpriseOrCloudOrSKUStarterFree && this.props.isEnterpriseReady) {
            highlightKeys = this.props.highlightKeys;
        }

        return (
            <Markdown
                imageProps={this.props.imageProps}
                message={message}
                mentionKeys={this.props.mentionKeys}
                highlightKeys={highlightKeys}
                options={options}
                channelNamesMap={channelNamesMap}
                hasPluginTooltips={this.props.hasPluginTooltips}
                imagesMetadata={this.props.post?.metadata?.images}
                postId={this.props.post?.id}
                editedAt={this.props.showPostEditedIndicator ? this.props.post?.edit_at : undefined}
                allowInlineActions={allowInlineActions}
                mmBlocksActionCookie={mmBlocksActionsCookie}
                integrationFormat={integrationFormat}
            />
        );
    }
}
