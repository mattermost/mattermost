// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {Post} from '@mattermost/types/posts';

import {getChannelByNameAndTeamName} from 'mattermost-redux/actions/channels';
import {Posts} from 'mattermost-redux/constants';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';

import Markdown from 'components/markdown';
import {DataSpillageReport} from 'components/post_view/data_spillage_report/data_spillage_report';

import {PostTypes} from 'utils/constants';
import {extractChannelMentionsFromPost, type TextFormattingOptions} from 'utils/text_formatting';

import type {GlobalState} from 'types/store';

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

    const dispatch = useDispatch();

    // Get all channels from redux store
    const allChannels = useSelector((state: GlobalState) => state.entities.channels.channels);
    const postChannelTeamId = useSelector((state: GlobalState) => {
        if (!post) {
            return null;
        }
        const postChannel = getChannel(state, post.channel_id);
        return postChannel?.team_id || null;
    });

    // Extract channel mentions from post and determine which ones are missing
    const {mentionsToFetch} = useMemo(() => {
        if (!post) {
            return {mentionsToFetch: []};
        }

        // Extract all mentions from post content (message + attachments)
        const allMentions = extractChannelMentionsFromPost(post);

        // Filter to find mentions not in redux store
        const missing = allMentions.filter((channelName) => {
            // Check if channel exists in redux store by name
            const channelExists = Object.values(allChannels).some(
                (ch) => ch.name.toLowerCase() === channelName && ch.team_id === postChannelTeamId,
            );

            return !channelExists;
        });

        return {mentionsToFetch: missing};
    }, [post, allChannels, postChannelTeamId]);

    // Get teams for building channel names map
    const allTeams = useSelector((state: GlobalState) => state.entities.teams.teams);
    const postTeam = useSelector((state: GlobalState) => {
        if (!postChannelTeamId) {
            return null;
        }
        return state.entities.teams.teams[postChannelTeamId] || null;
    });

    // Fetch missing channels
    useEffect(() => {
        if (mentionsToFetch.length === 0 || !postTeam) {
            return;
        }

        // Dispatch fetch for each missing channel
        mentionsToFetch.forEach((channelName) => {
            dispatch(getChannelByNameAndTeamName(postTeam.name, channelName, true) as any).catch((error: Error) => {
                // Channel might not exist or be private - this is expected, log for debugging
                // eslint-disable-next-line no-console
                console.debug(`Unable to fetch channel mention ${channelName}:`, error);
            });
        });
    }, [mentionsToFetch, postTeam, dispatch]);

    // Build enhanced channel names map with data from redux store
    const channelNamesMap = useMemo(() => {
        if (!post) {
            return undefined;
        }

        // Start with enhanced map
        const enhanced: {[key: string]: {display_name: string; team_name?: string}} = {};

        // Add channels from redux store that we found
        const allMentions = extractChannelMentionsFromPost(post);
        allMentions.forEach((channelName) => {
            if (enhanced[channelName]) {
                return; // Already have it
            }

            // Find channel in redux store
            const matchingChannel = Object.values(allChannels).find(
                (ch) => ch.name.toLowerCase() === channelName && ch.team_id === postChannelTeamId,
            );

            if (matchingChannel) {
                const channelTeam = allTeams[matchingChannel.team_id];
                enhanced[channelName] = {
                    display_name: matchingChannel.display_name,
                    team_name: channelTeam?.name,
                };
            }
        });

        return Object.keys(enhanced).length > 0 ? enhanced : undefined;
    }, [post, allChannels, postChannelTeamId, allTeams]);

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

export default PostMarkdown;
