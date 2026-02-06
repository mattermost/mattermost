// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';
import type {CommandArgs} from '@mattermost/types/integrations';
import type {Post} from '@mattermost/types/posts';
import {PostPriority} from '@mattermost/types/posts';

import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import type {ActionFuncAsync} from 'types/store';
import type {DesktopNotificationArgs} from 'types/store/plugins';
import {encryptMessageHook, decryptMessageHook, isEncryptedMessage, attachFileEncryptionMetadata} from 'utils/encryption';

import {getPendingReplies} from 'selectors/views/discord_replies';
import {clearPendingReplies, generateQuoteText} from './views/discord_replies';

import type {NewPostMessageProps} from './new_post';

/**
 * @param {Post} originalPost
 * @returns {ActionFuncAsync<Post>}
 */
export function runMessageWillBePostedHooks(originalPost: Post): ActionFuncAsync<Post> {
    return async (dispatch, getState) => {
        const hooks = getState().plugins.components.MessageWillBePosted;

        let post = originalPost;

        if (hooks && hooks.length > 0) {
            for (const hook of hooks) {
                const result = await hook.hook?.(post); // eslint-disable-line no-await-in-loop

                if (result) {
                    if ('error' in result) {
                        return {
                            error: result.error,
                        };
                    }

                    post = result.post;
                }
            }
        }

        // Discord Replies - prepend quote text and add metadata (mattermost-extended)
        const state = getState();
        const config = getConfig(state);
        const discordRepliesEnabled = config?.FeatureFlagDiscordReplies === 'true';

        if (discordRepliesEnabled) {
            const pendingReplies = getPendingReplies(state);

            if (pendingReplies.length > 0) {
                // Generate quote text
                const quoteText = dispatch(generateQuoteText()) as string;

                // Prepend quote text to message, preserve user-selected priority
                post = {
                    ...post,
                    message: quoteText + post.message,
                    props: {
                        ...post.props,
                        discord_replies: pendingReplies,
                    },
                };

                // Clear pending replies after adding to post
                dispatch(clearPendingReplies());
            }
        }

        // Native encryption for encrypted priority posts (mattermost-extended)
        if (post.metadata?.priority?.priority === PostPriority.ENCRYPTED) {
            const userId = getCurrentUserId(getState());
            const encryptResult = await encryptMessageHook(post, userId);
            if ('error' in encryptResult) {
                return {
                    error: {
                        message: encryptResult.error,
                    },
                };
            }
            post = encryptResult.post;
        }

        return {data: post};
    };
}

/**
 * Runs MessageWillBeReceived hooks on received posts (mattermost-extended)
 * @param {Post} originalPost
 * @returns {ActionFuncAsync<Post>}
 */
export function runMessageWillBeReceivedHooks(originalPost: Post): ActionFuncAsync<Post> {
    return async (dispatch, getState) => {
        const state = getState();
        const currentUserId = getCurrentUserId(state);

        let post = originalPost;

        // Native decryption for encrypted messages (mattermost-extended)
        if (isEncryptedMessage(post.message)) {
            try {
                const result = await decryptMessageHook(post, currentUserId);
                post = result.post;
            } catch (error) {
                console.error('Failed to decrypt message:', error);
            }
        }

        const hooks = getState().plugins.components.MessageWillBeReceived;
        if (!hooks || hooks.length === 0) {
            return {data: post};
        }

        for (const hook of hooks) {
            const result = await hook.hook?.(post); // eslint-disable-line no-await-in-loop

            if (result && result.post) {
                post = result.post;
            }
        }

        return {data: post};
    };
}

export function runSlashCommandWillBePostedHooks(originalMessage: string, originalArgs: CommandArgs): ActionFuncAsync<{message: string; args: CommandArgs}> {
    return async (dispatch, getState) => {
        const hooks = getState().plugins.components.SlashCommandWillBePosted;
        if (!hooks || hooks.length === 0) {
            return {data: {message: originalMessage, args: originalArgs}};
        }

        let message = originalMessage;
        let args = originalArgs;

        for (const hook of hooks) {
            const result = await hook.hook?.(message, args); // eslint-disable-line no-await-in-loop

            if (result) {
                if ('error' in result) {
                    return {
                        error: result.error,
                    };
                }

                message = result.message;
                args = result.args;

                // The first plugin to consume the slash command by returning an empty object
                // should terminate the processing by subsequent plugins.
                if (Object.keys(result).length === 0) {
                    break;
                }
            }
        }

        return {data: {message, args}};
    };
}

export function runMessageWillBeUpdatedHooks(newPost: Partial<Post>, oldPost: Post): ActionFuncAsync<Partial<Post>> {
    return async (dispatch, getState) => {
        const hooks = getState().plugins.components.MessageWillBeUpdated;

        let post = newPost;

        if (hooks && hooks.length > 0) {
            for (const hook of hooks) {
                const result = await hook.hook?.(post, oldPost); // eslint-disable-line no-await-in-loop

                if (result) {
                    if ('error' in result) {
                        return {
                            error: result.error,
                        };
                    }

                    post = result.post;
                }
            }
        }

        // Native encryption for encrypted priority posts (mattermost-extended)
        // We check if either the new version has encrypted priority,
        // OR if the old version was encrypted and we are not explicitly changing priority.
        const isEncrypted = post.metadata?.priority?.priority === PostPriority.ENCRYPTED ||
            (oldPost?.metadata?.priority?.priority === PostPriority.ENCRYPTED && !post.metadata?.priority);

        if (isEncrypted) {
            const state = getState();
            const userId = getCurrentUserId(state);

            // Ensure priority is set in the updated post if it was missing but old post had it
            if (!post.metadata?.priority) {
                post.metadata = {
                    ...post.metadata,
                    priority: {
                        priority: PostPriority.ENCRYPTED,
                    },
                };
            }

            // In edit mode, we might only have changed fields.
            // Encryption needs the full message and channel_id.
            const encryptionPost = {
                ...oldPost,
                ...post,
            } as Post;

            const encryptResult = await encryptMessageHook(encryptionPost, userId);
            if ('error' in encryptResult) {
                return {
                    error: {
                        message: encryptResult.error,
                    },
                };
            }

            // We only want to patch the fields that were returned by the encryption hook
            post = {
                ...post,
                message: encryptResult.post.message,
            };

            // Clear decryption props if present
            if (post.props) {
                post.props = {...post.props};
                delete post.props.encryption_status;
                delete post.props.encrypted_by;
            }
        }

        return {data: post};
    };
}

export function runDesktopNotificationHooks(post: Post, msgProps: NewPostMessageProps, channel: Channel, teamId: string, args: DesktopNotificationArgs): ActionFuncAsync<DesktopNotificationArgs> {
    return async (dispatch, getState) => {
        const hooks = getState().plugins.components.DesktopNotificationHooks;
        if (!hooks || hooks.length === 0) {
            return {data: args};
        }

        let nextArgs = args;
        for (const hook of hooks) {
            const result = await hook.hook(post, msgProps, channel, teamId, nextArgs); // eslint-disable-line no-await-in-loop

            if (result) {
                if (result.error) {
                    return {error: result.error};
                }

                if (!result.args) {
                    return {error: 'returned empty args'};
                }

                nextArgs = result.args;
            }
        }

        return {data: nextArgs};
    };
}