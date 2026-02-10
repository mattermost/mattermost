// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import cloneDeep from 'lodash/cloneDeep';

import {addPendingReply, generateQuoteText} from 'actions/views/discord_replies';
import mockStore from 'tests/test_store';

describe('tests/mattermost_extended/discord_replies/discord_replies_actions', () => {
    const postId = 'post_id_abcdefghijklmno01';
    const userId = 'user_id_abcdefghijklmno01';

    const baseState = {
        entities: {
            general: {
                config: {
                    FeatureFlagDiscordReplies: 'true',
                    FeatureFlagVideoLinkEmbed: 'false',
                    SiteURL: 'http://localhost:8065',
                },
            },
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    [userId]: {id: userId, username: 'testuser', nickname: 'Test User', first_name: 'Test'},
                },
            },
            posts: {
                posts: {
                    [postId]: {
                        id: postId,
                        user_id: userId,
                        message: 'Hello world',
                        metadata: {},
                    },
                },
            },
            teams: {
                currentTeamId: 'team_id1',
                teams: {
                    team_id1: {id: 'team_id1', name: 'testteam'},
                },
            },
            preferences: {
                myPreferences: {},
            },
            channels: {
                currentChannelId: 'channel_id1',
            },
        },
        views: {
            discordReplies: {
                pendingReplies: [],
            },
        },
    };

    describe('addPendingReply - file attachment categories', () => {
        test('should detect image file attachment', () => {
            const state = cloneDeep(baseState);
            state.entities.posts.posts[postId].metadata = {
                files: [{mime_type: 'image/png'}],
            };
            const store = mockStore(state);

            store.dispatch(addPendingReply(postId));

            const action = store.getActions().find((a: {type: string}) => a.type === 'DISCORD_REPLY_ADD_PENDING');
            expect(action).toBeDefined();
            expect(action.reply.file_categories).toContain('image');
        });

        test('should detect video file attachment', () => {
            const state = cloneDeep(baseState);
            state.entities.posts.posts[postId].metadata = {
                files: [{mime_type: 'video/mp4'}],
            };
            const store = mockStore(state);

            store.dispatch(addPendingReply(postId));

            const action = store.getActions().find((a: {type: string}) => a.type === 'DISCORD_REPLY_ADD_PENDING');
            expect(action.reply.file_categories).toContain('video');
        });

        test('should detect audio file attachment', () => {
            const state = cloneDeep(baseState);
            state.entities.posts.posts[postId].metadata = {
                files: [{mime_type: 'audio/mpeg'}],
            };
            const store = mockStore(state);

            store.dispatch(addPendingReply(postId));

            const action = store.getActions().find((a: {type: string}) => a.type === 'DISCORD_REPLY_ADD_PENDING');
            expect(action.reply.file_categories).toContain('audio');
        });

        test('should detect document file attachment (PDF)', () => {
            const state = cloneDeep(baseState);
            state.entities.posts.posts[postId].metadata = {
                files: [{mime_type: 'application/pdf'}],
            };
            const store = mockStore(state);

            store.dispatch(addPendingReply(postId));

            const action = store.getActions().find((a: {type: string}) => a.type === 'DISCORD_REPLY_ADD_PENDING');
            expect(action.reply.file_categories).toContain('document');
        });

        test('should detect archive file attachment (zip)', () => {
            const state = cloneDeep(baseState);
            state.entities.posts.posts[postId].metadata = {
                files: [{mime_type: 'application/zip'}],
            };
            const store = mockStore(state);

            store.dispatch(addPendingReply(postId));

            const action = store.getActions().find((a: {type: string}) => a.type === 'DISCORD_REPLY_ADD_PENDING');
            expect(action.reply.file_categories).toContain('archive');
        });

        test('should detect code file attachment', () => {
            const state = cloneDeep(baseState);
            state.entities.posts.posts[postId].metadata = {
                files: [{mime_type: 'application/json'}],
            };
            const store = mockStore(state);

            store.dispatch(addPendingReply(postId));

            const action = store.getActions().find((a: {type: string}) => a.type === 'DISCORD_REPLY_ADD_PENDING');
            expect(action.reply.file_categories).toContain('code');
        });

        test('should detect generic file attachment', () => {
            const state = cloneDeep(baseState);
            state.entities.posts.posts[postId].metadata = {
                files: [{mime_type: 'application/octet-stream'}],
            };
            const store = mockStore(state);

            store.dispatch(addPendingReply(postId));

            const action = store.getActions().find((a: {type: string}) => a.type === 'DISCORD_REPLY_ADD_PENDING');
            expect(action.reply.file_categories).toContain('file');
        });

        test('should deduplicate categories for multiple files of same type', () => {
            const state = cloneDeep(baseState);
            state.entities.posts.posts[postId].metadata = {
                files: [
                    {mime_type: 'image/png'},
                    {mime_type: 'image/jpeg'},
                    {mime_type: 'image/gif'},
                ],
            };
            const store = mockStore(state);

            store.dispatch(addPendingReply(postId));

            const action = store.getActions().find((a: {type: string}) => a.type === 'DISCORD_REPLY_ADD_PENDING');
            const imageCount = action.reply.file_categories.filter((c: string) => c === 'image').length;
            expect(imageCount).toBe(1);
        });

        test('should include multiple categories for mixed file types', () => {
            const state = cloneDeep(baseState);
            state.entities.posts.posts[postId].metadata = {
                files: [
                    {mime_type: 'image/png'},
                    {mime_type: 'video/mp4'},
                    {mime_type: 'application/pdf'},
                ],
            };
            const store = mockStore(state);

            store.dispatch(addPendingReply(postId));

            const action = store.getActions().find((a: {type: string}) => a.type === 'DISCORD_REPLY_ADD_PENDING');
            expect(action.reply.file_categories).toContain('image');
            expect(action.reply.file_categories).toContain('video');
            expect(action.reply.file_categories).toContain('document');
        });

        test('should return empty categories for post with no files or embeds', () => {
            const state = cloneDeep(baseState);
            state.entities.posts.posts[postId].metadata = {};
            const store = mockStore(state);

            store.dispatch(addPendingReply(postId));

            const action = store.getActions().find((a: {type: string}) => a.type === 'DISCORD_REPLY_ADD_PENDING');
            expect(action.reply.file_categories).toEqual([]);
        });
    });

    describe('addPendingReply - embedded media detection', () => {
        test('should detect embedded image from link', () => {
            const state = cloneDeep(baseState);
            state.entities.posts.posts[postId].metadata = {
                embeds: [{type: 'image', url: 'https://example.com/photo.jpg'}],
            };
            const store = mockStore(state);

            store.dispatch(addPendingReply(postId));

            const action = store.getActions().find((a: {type: string}) => a.type === 'DISCORD_REPLY_ADD_PENDING');
            expect(action.reply.file_categories).toContain('image');
        });

        test('should detect animated gif from images metadata', () => {
            const state = cloneDeep(baseState);
            state.entities.posts.posts[postId].metadata = {
                embeds: [{type: 'image', url: 'https://example.com/funny.gif'}],
                images: {
                    'https://example.com/funny.gif': {format: 'gif', frameCount: 30, width: 400, height: 300},
                },
            };
            const store = mockStore(state);

            store.dispatch(addPendingReply(postId));

            const action = store.getActions().find((a: {type: string}) => a.type === 'DISCORD_REPLY_ADD_PENDING');
            expect(action.reply.file_categories).toContain('gif');
        });

        test('should treat single-frame gif as image (not animated)', () => {
            const state = cloneDeep(baseState);
            state.entities.posts.posts[postId].metadata = {
                embeds: [{type: 'image', url: 'https://example.com/static.gif'}],
                images: {
                    'https://example.com/static.gif': {format: 'gif', frameCount: 1, width: 100, height: 100},
                },
            };
            const store = mockStore(state);

            store.dispatch(addPendingReply(postId));

            const action = store.getActions().find((a: {type: string}) => a.type === 'DISCORD_REPLY_ADD_PENDING');
            expect(action.reply.file_categories).toContain('image');
            expect(action.reply.file_categories).not.toContain('gif');
        });

        test('should detect video link embed when VideoLinkEmbed is enabled', () => {
            const state = cloneDeep(baseState);
            state.entities.general.config.FeatureFlagVideoLinkEmbed = 'true';
            state.entities.posts.posts[postId].metadata = {
                embeds: [{type: 'link', url: 'https://example.com/clip.mp4'}],
            };
            const store = mockStore(state);

            store.dispatch(addPendingReply(postId));

            const action = store.getActions().find((a: {type: string}) => a.type === 'DISCORD_REPLY_ADD_PENDING');
            expect(action.reply.file_categories).toContain('video');
        });

        test('should NOT detect video link embed when VideoLinkEmbed is disabled', () => {
            const state = cloneDeep(baseState);
            state.entities.general.config.FeatureFlagVideoLinkEmbed = 'false';
            state.entities.posts.posts[postId].metadata = {
                embeds: [{type: 'link', url: 'https://example.com/clip.mp4'}],
            };
            const store = mockStore(state);

            store.dispatch(addPendingReply(postId));

            const action = store.getActions().find((a: {type: string}) => a.type === 'DISCORD_REPLY_ADD_PENDING');
            expect(action.reply.file_categories).not.toContain('video');
        });

        test('should detect video in opengraph embed when VideoLinkEmbed is enabled', () => {
            const state = cloneDeep(baseState);
            state.entities.general.config.FeatureFlagVideoLinkEmbed = 'true';
            state.entities.posts.posts[postId].metadata = {
                embeds: [{type: 'opengraph', url: 'https://example.com/video.webm'}],
            };
            const store = mockStore(state);

            store.dispatch(addPendingReply(postId));

            const action = store.getActions().find((a: {type: string}) => a.type === 'DISCORD_REPLY_ADD_PENDING');
            expect(action.reply.file_categories).toContain('video');
        });

        test('should not treat non-video opengraph link as video', () => {
            const state = cloneDeep(baseState);
            state.entities.general.config.FeatureFlagVideoLinkEmbed = 'true';
            state.entities.posts.posts[postId].metadata = {
                embeds: [{type: 'opengraph', url: 'https://example.com/article'}],
            };
            const store = mockStore(state);

            store.dispatch(addPendingReply(postId));

            const action = store.getActions().find((a: {type: string}) => a.type === 'DISCORD_REPLY_ADD_PENDING');
            expect(action.reply.file_categories).not.toContain('video');
        });

        test('should detect image from images metadata (non-gif)', () => {
            const state = cloneDeep(baseState);
            state.entities.posts.posts[postId].metadata = {
                images: {
                    'https://example.com/photo.png': {format: 'png', width: 800, height: 600},
                },
            };
            const store = mockStore(state);

            store.dispatch(addPendingReply(postId));

            const action = store.getActions().find((a: {type: string}) => a.type === 'DISCORD_REPLY_ADD_PENDING');
            expect(action.reply.file_categories).toContain('image');
        });

        test('should combine file attachments and embedded media categories', () => {
            const state = cloneDeep(baseState);
            state.entities.general.config.FeatureFlagVideoLinkEmbed = 'true';
            state.entities.posts.posts[postId].metadata = {
                files: [{mime_type: 'application/pdf'}],
                embeds: [
                    {type: 'image', url: 'https://example.com/photo.jpg'},
                    {type: 'link', url: 'https://example.com/clip.mp4'},
                ],
            };
            const store = mockStore(state);

            store.dispatch(addPendingReply(postId));

            const action = store.getActions().find((a: {type: string}) => a.type === 'DISCORD_REPLY_ADD_PENDING');
            expect(action.reply.file_categories).toContain('document');
            expect(action.reply.file_categories).toContain('image');
            expect(action.reply.file_categories).toContain('video');
        });
    });

    describe('addPendingReply - text handling', () => {
        test('should take only first line of multi-line message', () => {
            const state = cloneDeep(baseState);
            state.entities.posts.posts[postId].message = 'First line\nSecond line\nThird line';
            const store = mockStore(state);

            store.dispatch(addPendingReply(postId));

            const action = store.getActions().find((a: {type: string}) => a.type === 'DISCORD_REPLY_ADD_PENDING');
            expect(action.reply.text).toBe('First line');
        });

        test('should take only first line of multi-paragraph message', () => {
            const state = cloneDeep(baseState);
            state.entities.posts.posts[postId].message = 'First paragraph\n\nSecond paragraph\n\nThird paragraph';
            const store = mockStore(state);

            store.dispatch(addPendingReply(postId));

            const action = store.getActions().find((a: {type: string}) => a.type === 'DISCORD_REPLY_ADD_PENDING');
            expect(action.reply.text).toBe('First paragraph');
        });

        test('should strip quote lines before taking first line', () => {
            const state = cloneDeep(baseState);
            state.entities.posts.posts[postId].message = '>quoted text\nActual reply';
            const store = mockStore(state);

            store.dispatch(addPendingReply(postId));

            const action = store.getActions().find((a: {type: string}) => a.type === 'DISCORD_REPLY_ADD_PENDING');
            expect(action.reply.text).toBe('Actual reply');
        });

        test('should truncate long first line to 100 chars', () => {
            const state = cloneDeep(baseState);
            const longLine = 'A'.repeat(150);
            state.entities.posts.posts[postId].message = longLine;
            const store = mockStore(state);

            store.dispatch(addPendingReply(postId));

            const action = store.getActions().find((a: {type: string}) => a.type === 'DISCORD_REPLY_ADD_PENDING');
            expect(action.reply.text.length).toBe(100);
            expect(action.reply.text.endsWith('...')).toBe(true);
        });

        test('should handle empty message', () => {
            const state = cloneDeep(baseState);
            state.entities.posts.posts[postId].message = '';
            const store = mockStore(state);

            store.dispatch(addPendingReply(postId));

            const action = store.getActions().find((a: {type: string}) => a.type === 'DISCORD_REPLY_ADD_PENDING');
            expect(action.reply.text).toBe('');
        });
    });

    describe('generateQuoteText - emoji formatting', () => {
        test('should include image emoji in quote for image attachment', () => {
            const state = cloneDeep(baseState);
            state.views.discordReplies.pendingReplies = [{
                post_id: postId,
                user_id: userId,
                username: 'testuser',
                nickname: 'Test User',
                text: 'Check this out',
                has_image: true,
                has_video: false,
                file_categories: ['image'],
            }];
            const store = mockStore(state);

            const result = store.dispatch(generateQuoteText());
            expect(result).toContain('🖼️');
            expect(result).toContain('Check this out');
        });

        test('should include video emoji in quote for video attachment', () => {
            const state = cloneDeep(baseState);
            state.views.discordReplies.pendingReplies = [{
                post_id: postId,
                user_id: userId,
                username: 'testuser',
                nickname: 'Test User',
                text: 'Watch this',
                has_image: false,
                has_video: true,
                file_categories: ['video'],
            }];
            const store = mockStore(state);

            const result = store.dispatch(generateQuoteText());
            expect(result).toContain('🎥');
            expect(result).toContain('Watch this');
        });

        test('should include gif emoji in quote for animated gif', () => {
            const state = cloneDeep(baseState);
            state.views.discordReplies.pendingReplies = [{
                post_id: postId,
                user_id: userId,
                username: 'testuser',
                nickname: 'Test User',
                text: 'Funny gif',
                has_image: true,
                has_video: false,
                file_categories: ['gif'],
            }];
            const store = mockStore(state);

            const result = store.dispatch(generateQuoteText());
            expect(result).toContain('🎞️');
        });

        test('should include multiple emojis for mixed media', () => {
            const state = cloneDeep(baseState);
            state.views.discordReplies.pendingReplies = [{
                post_id: postId,
                user_id: userId,
                username: 'testuser',
                nickname: 'Test User',
                text: 'Mixed content',
                has_image: true,
                has_video: true,
                file_categories: ['image', 'video', 'document'],
            }];
            const store = mockStore(state);

            const result = store.dispatch(generateQuoteText());
            expect(result).toContain('🖼️');
            expect(result).toContain('🎥');
            expect(result).toContain('📄');
        });

        test('should show only emojis when text is empty', () => {
            const state = cloneDeep(baseState);
            state.views.discordReplies.pendingReplies = [{
                post_id: postId,
                user_id: userId,
                username: 'testuser',
                nickname: 'Test User',
                text: '',
                has_image: true,
                has_video: false,
                file_categories: ['image'],
            }];
            const store = mockStore(state);

            const result = store.dispatch(generateQuoteText());
            expect(result).toContain('🖼️');
            expect(result).toContain('>[@testuser]');
        });

        test('should have no emojis for text-only post', () => {
            const state = cloneDeep(baseState);
            state.views.discordReplies.pendingReplies = [{
                post_id: postId,
                user_id: userId,
                username: 'testuser',
                nickname: 'Test User',
                text: 'Just text',
                has_image: false,
                has_video: false,
                file_categories: [],
            }];
            const store = mockStore(state);

            const result = store.dispatch(generateQuoteText());
            expect(result).not.toContain('🖼️');
            expect(result).not.toContain('🎥');
            expect(result).not.toContain('🎞️');
            expect(result).toContain('Just text');
        });
    });
});
