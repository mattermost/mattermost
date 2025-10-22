// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as TextFormatting from 'utils/text_formatting';

describe('TextFormatting.ChannelMentions', () => {
    describe('extractChannelMentions', () => {
        it('should extract single channel mention', () => {
            expect(TextFormatting.extractChannelMentions('Check out ~engineering')).toEqual(['engineering']);
        });

        it('should extract multiple channel mentions', () => {
            expect(TextFormatting.extractChannelMentions('~engineering and ~qa-team')).toEqual(['engineering', 'qa-team']);
        });

        it('should handle channel names with hyphens, underscores, and dots', () => {
            expect(TextFormatting.extractChannelMentions('~my-channel ~my_channel ~my.channel')).toEqual([
                'my-channel',
                'my_channel',
                'my.channel',
            ]);
        });

        it('should handle channel names with numbers', () => {
            expect(TextFormatting.extractChannelMentions('~team123 ~project2024')).toEqual(['team123', 'project2024']);
        });

        it('should deduplicate channel mentions', () => {
            expect(TextFormatting.extractChannelMentions('~engineering and ~engineering again')).toEqual(['engineering']);
        });

        it('should be case-insensitive and normalize to lowercase', () => {
            expect(TextFormatting.extractChannelMentions('~Engineering and ~ENGINEERING')).toEqual(['engineering']);
        });

        it('should return empty array for text without channel mentions', () => {
            expect(TextFormatting.extractChannelMentions('No channels here')).toEqual([]);
        });

        it('should return empty array for text with only tilde', () => {
            expect(TextFormatting.extractChannelMentions('Just a ~ character')).toEqual([]);
        });

        it('should require at least one character after tilde', () => {
            expect(TextFormatting.extractChannelMentions('~')).toEqual([]);
            expect(TextFormatting.extractChannelMentions('~ ')).toEqual([]);
        });

        it('should handle channel mentions at start of text', () => {
            expect(TextFormatting.extractChannelMentions('~engineering is great')).toEqual(['engineering']);
        });

        it('should handle channel mentions at end of text', () => {
            expect(TextFormatting.extractChannelMentions('Check out ~engineering')).toEqual(['engineering']);
        });

        it('should handle channel mentions surrounded by punctuation', () => {
            expect(TextFormatting.extractChannelMentions('(~engineering)')).toEqual(['engineering']);
            expect(TextFormatting.extractChannelMentions('~engineering,')).toEqual(['engineering']);

            // Dot is a valid channel name character, so it's included
            expect(TextFormatting.extractChannelMentions('~engineering.')).toEqual(['engineering.']);
        });

        it('should extract mentions even in URLs (regex matches ~name pattern)', () => {
            // The regex uses \B (non-word boundary before ~) which matches after /
            expect(TextFormatting.extractChannelMentions('https://example.com/~engineering')).toEqual(['engineering']);

            // But not after alphanumeric characters (word boundary required)
            expect(TextFormatting.extractChannelMentions('home~engineering')).toEqual([]);
        });

        it('should handle empty string', () => {
            expect(TextFormatting.extractChannelMentions('')).toEqual([]);
        });

        it('should handle multiline text', () => {
            const text = `First line ~engineering
Second line ~qa-team
Third line ~engineering`;
            expect(TextFormatting.extractChannelMentions(text)).toEqual(['engineering', 'qa-team']);
        });
    });

    describe('extractChannelMentionsFromPost', () => {
        it('should extract from main message only', () => {
            const post = {
                message: 'Check out ~engineering',
            };
            expect(TextFormatting.extractChannelMentionsFromPost(post)).toEqual(['engineering']);
        });

        it('should extract from attachment pretext', () => {
            const post = {
                message: '',
                props: {
                    attachments: [
                        {
                            pretext: 'Deployed to ~engineering',
                        },
                    ],
                },
            };
            expect(TextFormatting.extractChannelMentionsFromPost(post)).toEqual(['engineering']);
        });

        it('should extract from attachment text', () => {
            const post = {
                message: '',
                props: {
                    attachments: [
                        {
                            text: 'Status for ~qa-team',
                        },
                    ],
                },
            };
            expect(TextFormatting.extractChannelMentionsFromPost(post)).toEqual(['qa-team']);
        });

        it('should NOT extract from attachment title', () => {
            const post = {
                message: '',
                props: {
                    attachments: [
                        {
                            title: 'Status for ~engineering',
                            text: '',
                        },
                    ],
                },
            };

            // Title should not be scanned - it's a label, not content
            expect(TextFormatting.extractChannelMentionsFromPost(post)).toEqual([]);
        });

        it('should extract from field values', () => {
            const post = {
                message: '',
                props: {
                    attachments: [
                        {
                            fields: [
                                {
                                    title: 'Channel',
                                    value: '~engineering',
                                },
                            ],
                        },
                    ],
                },
            };
            expect(TextFormatting.extractChannelMentionsFromPost(post)).toEqual(['engineering']);
        });

        it('should NOT extract from field titles', () => {
            const post = {
                message: '',
                props: {
                    attachments: [
                        {
                            fields: [
                                {
                                    title: '~engineering',
                                    value: 'Some value',
                                },
                            ],
                        },
                    ],
                },
            };

            // Field title should not be scanned - it's a label, not content
            expect(TextFormatting.extractChannelMentionsFromPost(post)).toEqual([]);
        });

        it('should extract from multiple attachments', () => {
            const post = {
                message: '',
                props: {
                    attachments: [
                        {
                            text: 'First ~engineering',
                        },
                        {
                            text: 'Second ~qa-team',
                        },
                    ],
                },
            };
            expect(TextFormatting.extractChannelMentionsFromPost(post)).toEqual(['engineering', 'qa-team']);
        });

        it('should extract from message and attachments combined', () => {
            const post = {
                message: 'Deployed to ~engineering',
                props: {
                    attachments: [
                        {
                            pretext: 'Also notifying ~qa-team',
                            text: 'And ~support',
                            fields: [
                                {
                                    title: 'Channels',
                                    value: '~engineering, ~qa-team',
                                },
                            ],
                        },
                    ],
                },
            };
            expect(TextFormatting.extractChannelMentionsFromPost(post)).toEqual([
                'engineering',
                'qa-team',
                'support',
            ]);
        });

        it('should deduplicate across message and attachments', () => {
            const post = {
                message: 'Check ~engineering',
                props: {
                    attachments: [
                        {
                            text: 'Also ~engineering',
                        },
                    ],
                },
            };
            expect(TextFormatting.extractChannelMentionsFromPost(post)).toEqual(['engineering']);
        });

        it('should handle post without attachments', () => {
            const post = {
                message: 'Check out ~engineering',
                props: {},
            };
            expect(TextFormatting.extractChannelMentionsFromPost(post)).toEqual(['engineering']);
        });

        it('should handle post without props', () => {
            const post = {
                message: 'Check out ~engineering',
            };
            expect(TextFormatting.extractChannelMentionsFromPost(post)).toEqual(['engineering']);
        });

        it('should handle empty post', () => {
            const post = {
                message: '',
            };
            expect(TextFormatting.extractChannelMentionsFromPost(post)).toEqual([]);
        });

        it('should handle malformed attachments gracefully', () => {
            const post = {
                message: '',
                props: {
                    attachments: [
                        null,
                        {
                            text: '~engineering',
                        },
                        'invalid',
                    ],
                },
            };
            expect(TextFormatting.extractChannelMentionsFromPost(post)).toEqual(['engineering']);
        });

        it('should handle field value as non-string', () => {
            const post = {
                message: '',
                props: {
                    attachments: [
                        {
                            fields: [
                                {
                                    title: 'Count',
                                    value: 123,
                                },
                                {
                                    title: 'Channel',
                                    value: '~engineering',
                                },
                            ],
                        },
                    ],
                },
            };

            // Should convert non-string value to string and extract mentions
            expect(TextFormatting.extractChannelMentionsFromPost(post)).toEqual(['engineering']);
        });

        it('should handle complex real-world webhook payload', () => {
            const post = {
                message: 'Deployment notification',
                props: {
                    attachments: [
                        {
                            pretext: 'New deployment to production',
                            text: 'Successfully deployed to ~engineering and ~qa-team',
                            fields: [
                                {
                                    title: 'Environment',
                                    value: 'Production',
                                    short: true,
                                },
                                {
                                    title: 'Notified Channels',
                                    value: '~engineering, ~qa-team, ~support',
                                    short: true,
                                },
                            ],
                        },
                    ],
                },
            };
            expect(TextFormatting.extractChannelMentionsFromPost(post)).toEqual([
                'engineering',
                'qa-team',
                'support',
            ]);
        });
    });
});
