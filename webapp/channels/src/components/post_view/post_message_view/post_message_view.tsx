// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, injectIntl} from 'react-intl';
import type {IntlShape} from 'react-intl';

import type {Post} from '@mattermost/types/posts';

import {Posts} from 'mattermost-redux/constants';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import type {Theme} from 'mattermost-redux/selectors/entities/preferences';
import {isPostEphemeral} from 'mattermost-redux/utils/post_utils';

import store from 'stores/redux_store';

import PostMarkdown from 'components/post_markdown';
import ShowMore from 'components/post_view/show_more';
import type {AttachmentTextOverflowType} from 'components/post_view/show_more/show_more';

import Pluggable from 'plugins/pluggable';
import {PostTypes} from 'utils/constants';
import type {TextFormattingOptions} from 'utils/text_formatting';
import * as Utils from 'utils/utils';

import type {PostPluginComponent} from 'types/store/plugins';

// These posts types must not be rendered with the collapsible "Show More" container.
const FULL_HEIGHT_POST_TYPES = new Set([
    PostTypes.CUSTOM_DATA_SPILLAGE_REPORT,
]);

type Props = {
    post: Post; /* The post to render the message for */
    enableFormatting?: boolean; /* Set to enable Markdown formatting */
    options?: TextFormattingOptions; /* Options specific to text formatting */
    compactDisplay?: boolean; /* Set to render post body compactly */
    isRHS?: boolean; /* Flags if the post_message_view is for the RHS (Reply). */
    isRHSOpen?: boolean; /* Whether or not the RHS is visible */
    isRHSExpanded?: boolean; /* Whether or not the RHS is expanded */
    theme: Theme; /* Logged in user's theme */
    pluginPostTypes?: {
        [postType: string]: PostPluginComponent;
    }; /* Post type components from plugins */
    currentRelativeTeamUrl: string;
    overflowType?: AttachmentTextOverflowType;
    maxHeight?: number; /* The max height used by the show more component */
    showPostEditedIndicator?: boolean; /* Whether or not to render the post edited indicator */
    sharedChannelsPluginsEnabled?: boolean;
    intl: IntlShape; /* For injectIntl */
}

type State = {
    collapse: boolean;
    hasOverflow: boolean;
    checkOverflow: number;
}

class PostMessageView extends React.PureComponent<Props, State> {
    private imageProps: any;

    static defaultProps = {
        options: {},
        isRHS: false,
        pluginPostTypes: {},
        overflowType: undefined,
    };

    constructor(props: Props) {
        super(props);

        this.state = {
            collapse: true,
            hasOverflow: false,
            checkOverflow: 0,
        };

        this.imageProps = {
            onImageLoaded: this.handleHeightReceived,
            onImageHeightChanged: this.checkPostOverflow,
        };
    }

    /**
     * Translate message if it has a message_key in Props
     */
    private getTranslatedMessage(post: Post): string {
        if (post.props?.message_key && post.props?.message_data) {
            const messageKey = post.props.message_key;
            const messageData = post.props.message_data as Record<string, any>;

            const formattedData = {...messageData};

            // Extract non-template keys before ICU formatting
            const fileID = formattedData.FileID;
            delete formattedData.FileID;

            if (formattedData.Time && typeof formattedData.Time === 'number') {
                const timeDate = new Date(formattedData.Time * 1000);
                formattedData.Time = this.props.intl.formatTime(timeDate, {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                });
            }

            // Pre-translate leave type and status enum values
            if (formattedData.LeaveType && typeof formattedData.LeaveType === 'string') {
                formattedData.LeaveType = this.props.intl.formatMessage(
                    {id: `leave.type.${formattedData.LeaveType}`, defaultMessage: formattedData.LeaveType},
                );
            }
            if (formattedData.Status && typeof formattedData.Status === 'string') {
                formattedData.Status = this.props.intl.formatMessage(
                    {id: `leave.status.${formattedData.Status}`, defaultMessage: formattedData.Status},
                );
            }

            // Pre-translate break reason keys (e.g. "di_an" → "Đi ăn")
            if (formattedData.Reason && typeof formattedData.Reason === 'string' &&
                messageKey.startsWith('attendance.msg.break_')) {
                formattedData.Reason = this.props.intl.formatMessage(
                    {id: `attendance.break_reason.${formattedData.Reason}`, defaultMessage: formattedData.Reason},
                );
            }

            // Format duration fields from raw seconds to localized strings
            const durationFields = ['Duration', 'TotalTime', 'ActualWorkTime', 'TotalBreakTime'];
            for (const field of durationFields) {
                if (typeof formattedData[field] === 'number') {
                    formattedData[field] = this.formatDuration(formattedData[field] as number);
                }
            }

            // Build BreakList from structured Breaks array
            if (Array.isArray(formattedData.Breaks)) {
                const lines = (formattedData.Breaks as Array<{Reason: string; Duration: number}>).map(
                    (b, idx) => {
                        const reason = this.props.intl.formatMessage(
                            {id: `attendance.break_reason.${b.Reason}`, defaultMessage: b.Reason},
                        );
                        const dur = this.formatDuration(b.Duration);
                        return `${idx + 1}. ${reason} — ${dur}`;
                    },
                );
                formattedData.BreakList = lines.length > 0 ? lines.join('\n') + '\n' : '';
                delete formattedData.Breaks;
            }

            try {
                let translated = this.props.intl.formatMessage(
                    {id: messageKey, defaultMessage: post.message},
                    formattedData,
                );
                if (fileID) {
                    translated += `\n\n![photo](/api/v4/files/${fileID}/preview)`;
                }
                return translated;
            } catch (e) {
                // If translation fails, fall back to original message
                console.warn(`Failed to translate message key: ${messageKey}`, e);
                return post.message;
            }
        }
        return post.message;
    }

    private formatDuration(totalSeconds: number): string {
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        const parts: string[] = [];
        if (h > 0) {
            const unit = this.props.intl.formatMessage({id: 'duration.h', defaultMessage: 'hr'});
            parts.push(`${h} ${unit}`);
        }
        if (m > 0) {
            const unit = this.props.intl.formatMessage({id: 'duration.m', defaultMessage: 'min'});
            parts.push(`${m} ${unit}`);
        }
        if (s > 0 || parts.length === 0) {
            const unit = this.props.intl.formatMessage({id: 'duration.s', defaultMessage: 'sec'});
            parts.push(`${s} ${unit}`);
        }
        return parts.join(' ');
    }

    checkPostOverflow = () => {
        // Increment checkOverflow to indicate change in height
        // and recompute textContainer height at ShowMore component
        // and see whether overflow text of show more/less is necessary or not.
        this.setState((prevState) => {
            return {checkOverflow: prevState.checkOverflow + 1};
        });
    };

    handleHeightReceived = (height: number) => {
        if (height > 0) {
            this.checkPostOverflow();
        }
    };

    renderDeletedPost() {
        return (
            <p>
                <FormattedMessage
                    id='post_body.deleted'
                    defaultMessage='(message deleted)'
                />
            </p>
        );
    }

    handleFormattedTextClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) =>
        Utils.handleFormattedTextClick(e, this.props.currentRelativeTeamUrl);

    render() {
        const {
            post,
            enableFormatting,
            options,
            pluginPostTypes,
            compactDisplay,
            isRHS,
            theme,
            overflowType,
            maxHeight,
        } = this.props;

        if (post.state === Posts.POST_DELETED) {
            return this.renderDeletedPost();
        }

        if (!enableFormatting) {
            return <span>{this.getTranslatedMessage(post)}</span>;
        }

        const postType = typeof post.props?.type === 'string' ? post.props.type : post.type;

        if (pluginPostTypes && Object.hasOwn(pluginPostTypes, postType)) {
            const PluginComponent = pluginPostTypes[postType].component;
            return (
                <PluginComponent
                    post={post}
                    compactDisplay={compactDisplay}
                    isRHS={isRHS}
                    theme={theme}
                />
            );
        }

        let message = this.getTranslatedMessage(post);
        const isEphemeral = isPostEphemeral(post);
        if (compactDisplay && isEphemeral) {
            const visibleMessage = Utils.localizeMessage({id: 'post_info.message.visible.compact', defaultMessage: ' (Only visible to you)'});
            message = message.concat(visibleMessage);
        }

        const id = isRHS ? `rhsPostMessageText_${post.id}` : `postMessageText_${post.id}`;

        // Check if channel is shared
        const channel = getChannel(store.getState(), post.channel_id);
        const isSharedChannel = channel?.shared || false;

        const body = (
            <>
                <div
                    id={id}
                    className='post-message__text'
                    dir='auto'
                    onClick={this.handleFormattedTextClick}
                >
                    <PostMarkdown
                        message={message}
                        imageProps={this.imageProps}
                        options={options}
                        post={post}
                        channelId={post.channel_id}
                        showPostEditedIndicator={this.props.showPostEditedIndicator}
                        isRHS={isRHS}
                    />
                </div>
                {(!isSharedChannel || this.props.sharedChannelsPluginsEnabled) && (
                    <Pluggable
                        pluggableName='PostMessageAttachment'
                        postId={post.id}
                        onHeightChange={this.handleHeightReceived}
                    />
                )}
            </>
        );

        if (FULL_HEIGHT_POST_TYPES.has(postType)) {
            return body;
        }

        return (
            <ShowMore
                checkOverflow={this.state.checkOverflow}
                text={message}
                overflowType={overflowType}
                maxHeight={maxHeight}
            >
                {body}
            </ShowMore>
        );
    }
}

export default injectIntl(PostMessageView);
