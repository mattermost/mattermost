// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {useSelector, shallowEqual} from 'react-redux';

import type {Post} from '@mattermost/types/posts';

import {Posts} from 'mattermost-redux/constants';
import {getAllChannels} from 'mattermost-redux/selectors/entities/channels';
import {getTeams} from 'mattermost-redux/selectors/entities/teams';

import Markdown from 'components/markdown';
import {DataSpillageReport} from 'components/post_view/data_spillage_report/data_spillage_report';

import {PostTypes} from 'utils/constants';
import {extractChannelMentionsFromPost, isChannelNamesMap, type TextFormattingOptions} from 'utils/text_formatting';

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
};

type Props = PropsFromRedux & OwnProps;

const PostMarkdown: React.FC<Props> = (props) => {
    const {
        message: initialMessage,
        post,
        channel,
        currentTeam,
        pluginHooks = [],
        options = {},
        showPostEditedIndicator = true,
        imageProps,
        mentionKeys,
        highlightKeys,
        hasPluginTooltips,
        hideGuestTags,
        isUserCanManageMembers,
        isMilitaryTime,
        timezone,
        isEnterpriseOrCloudOrSKUStarterFree,
        isEnterpriseReady,
        renderEmoticonsAsEmoji: propsRenderEmoticonsAsEmoji,
        isRHS,
    } = props;

    // Get all channels and teams from redux store for building channel names map
    // Use shallowEqual to prevent re-renders when unrelated channels/teams change
    const allChannels = useSelector(getAllChannels, shallowEqual);
    const allTeams = useSelector(getTeams, shallowEqual);

    // Build channel names map by merging server-provided data (post.props.channel_mentions)
    // with fresh data from Redux store. This supports:
    // 1. Cross-team channel mentions in DMs (from server-side rendering)
    // 2. Up-to-date channel names after renames (from Redux store)
    const channelNamesMap = useMemo(() => {
        if (!post) {
            return undefined;
        }

        const enhanced: {[key: string]: {display_name: string; team_name?: string}} = {};

        // Start with server-provided channel_mentions (trusted, supports cross-team in DMs)
        if (isChannelNamesMap(post.props?.channel_mentions)) {
            Object.entries(post.props.channel_mentions).forEach(([channelName, channelData]) => {
                if (typeof channelData === 'string') {
                    enhanced[channelName] = {display_name: channelData};
                } else {
                    enhanced[channelName] = channelData;
                }
            });
        }

        // Determine if this is a DM/GM (no team_id on channel)
        const isDMorGM = !channel?.team_id;

        // Default team to search: post's team or current viewing team
        const defaultSearchTeamId = channel?.team_id || currentTeam?.id;

        // Override with fresh data from Redux store (only from relevant team)
        // This ensures up-to-date names while preventing wrong-team matches
        const allMentions = extractChannelMentionsFromPost(post);
        allMentions.forEach((channelName) => {
            // Determine which team to search:
            // 1. If server provided team_name for this channel, use that team (most specific)
            // 2. Otherwise use default (post's team or current team)
            let targetTeamId = defaultSearchTeamId;

            const serverProvidedData = enhanced[channelName];
            if (serverProvidedData?.team_name) {
                // Find team by name from server data
                const serverTeam = Object.values(allTeams).find(
                    (t) => t.name === serverProvidedData.team_name,
                );
                if (serverTeam) {
                    targetTeamId = serverTeam?.id;
                }
            }

            // Search Redux within the target team to get fresh data
            if (targetTeamId) {
                const matchingChannel = Object.values(allChannels).find(
                    (ch) => ch.name.toLowerCase() === channelName && ch.team_id === targetTeamId,
                );

                if (matchingChannel) {
                    const channelTeam = allTeams[matchingChannel.team_id];

                    // Override with fresh Redux data (even if server provided stale data)
                    enhanced[channelName] = {
                        display_name: matchingChannel.display_name,
                        team_name: channelTeam?.name,
                    };
                } else if (!isDMorGM && serverProvidedData) {
                    // For team channels: If not in Redux, remove server data (might be stale)
                    // This prevents broken links when channels become private or move teams
                    delete enhanced[channelName];
                }

                // For DMs: Keep server data (supports cross-team mentions we can't fetch)
            }
        });

        return Object.keys(enhanced).length > 0 ? enhanced : undefined;
    }, [post, channel, currentTeam, allChannels, allTeams]);

    // Compute markdown options (must be before early returns due to React hooks rules)
    let mentionHighlight = options?.mentionHighlight;
    if (post && post.props) {
        mentionHighlight = !post.props.mentionHighlightDisabled;
    }

    const markdownOptions = useMemo(() => ({
        ...options,
        disableGroupHighlight: post?.props?.disable_group_highlight === true,
        mentionHighlight,
        editedAt: post?.edit_at,
        renderEmoticonsAsEmoji: propsRenderEmoticonsAsEmoji,
    }), [options, post?.props?.disable_group_highlight, mentionHighlight, post?.edit_at, propsRenderEmoticonsAsEmoji]);

    // Apply plugin hooks
    let message = initialMessage;
    pluginHooks?.forEach((o) => {
        if (o && o.hook && post) {
            message = o.hook(post, message);
        }
    });

    // Handle system messages
    if (post) {
        const renderedSystemMessage = channel ? renderSystemMessage(
            post,
            currentTeam?.name ?? '',
            channel,
            hideGuestTags,
            isUserCanManageMembers,
            isMilitaryTime,
            timezone,
        ) : null;
        if (renderedSystemMessage) {
            return <div>{renderedSystemMessage}</div>;
        }
    }

    if (post && post.type === Posts.POST_TYPES.REMINDER) {
        if (!currentTeam) {
            return null;
        }
        const renderedSystemBotMessage = renderReminderSystemBotMessage(post, currentTeam);
        return <div>{renderedSystemBotMessage}</div>;
    }

    if (post && post.type === Posts.POST_TYPES.WRANGLER) {
        const renderedWranglerMessage = renderWranglerSystemMessage(post);
        return <div>{renderedWranglerMessage}</div>;
    }

    if (post && post.type === PostTypes.CUSTOM_DATA_SPILLAGE_REPORT) {
        return (
            <div>
                <DataSpillageReport
                    post={post}
                    isRHS={isRHS}
                />
            </div>
        );
    }

    // Proxy images if we have an image proxy and the server hasn't already rewritten the post's image URLs
    const proxyImages = !post || !post.message_source || post.message === post.message_source;

    const effectiveHighlightKeys = !isEnterpriseOrCloudOrSKUStarterFree && isEnterpriseReady ? highlightKeys : undefined;

    return (
        <Markdown
            imageProps={imageProps}
            message={message}
            proxyImages={proxyImages}
            mentionKeys={mentionKeys}
            highlightKeys={effectiveHighlightKeys}
            options={markdownOptions}
            channelNamesMap={channelNamesMap}
            hasPluginTooltips={hasPluginTooltips}
            imagesMetadata={post?.metadata?.images}
            postId={post?.id}
            editedAt={showPostEditedIndicator ? post?.edit_at : undefined}
        />
    );
};

// Wrap with React.memo to preserve PureComponent shallow comparison behavior
// PostMarkdown renders for every post on screen, so preventing unnecessary re-renders is critical
export default React.memo(PostMarkdown);
