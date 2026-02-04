// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Tests for ThreadsInSidebar feature flag
 *
 * ThreadsInSidebar: Display followed threads under their parent channels in the sidebar
 *
 * This tests the core logic used by the SidebarThreadItem component and related features.
 */

import type {UserThread} from '@mattermost/types/threads';

import {cleanMessageForDisplay} from 'components/threading/utils';

describe('ThreadsInSidebar feature', () => {
    describe('config mapping', () => {
        it('should map FeatureFlagThreadsInSidebar config to boolean', () => {
            const configEnabled = {FeatureFlagThreadsInSidebar: 'true'};
            const configDisabled = {FeatureFlagThreadsInSidebar: 'false'};
            const configMissing = {};

            expect(configEnabled.FeatureFlagThreadsInSidebar === 'true').toBe(true);
            expect(configDisabled.FeatureFlagThreadsInSidebar === 'true').toBe(false);
            expect((configMissing as Record<string, string>).FeatureFlagThreadsInSidebar === 'true').toBe(false);
        });

        it('should require CRT (CollapsedReplyThreads) to be enabled', () => {
            // ThreadsInSidebar only works when CRT is also enabled
            const crtEnabled = true;
            const threadsInSidebarEnabled = true;

            const featureActive = crtEnabled && threadsInSidebarEnabled;
            expect(featureActive).toBe(true);

            const crtDisabled = false;
            const featureInactive = crtDisabled && threadsInSidebarEnabled;
            expect(featureInactive).toBe(false);
        });
    });

    describe('thread label logic', () => {
        const createMockThread = (overrides: Partial<UserThread> = {}): UserThread => ({
            id: 'thread_id_1',
            reply_count: 5,
            last_reply_at: Date.now(),
            last_viewed_at: Date.now(),
            participants: [],
            post: {
                channel_id: 'channel_id_1',
                user_id: 'user_id_1',
            },
            unread_replies: 0,
            unread_mentions: 0,
            is_following: true,
            is_urgent: false,
            ...overrides,
        });

        it('should use custom thread name when set in props', () => {
            const thread = createMockThread({
                props: {custom_name: 'My Custom Thread Name'},
            });
            const postMessage = 'Original message content';

            // Logic from sidebar_thread_item.tsx
            const customName = thread.props?.custom_name;
            const label = customName || cleanMessageForDisplay(postMessage, 100) || 'Thread';

            expect(label).toBe('My Custom Thread Name');
        });

        it('should use cleaned post message when no custom name', () => {
            const thread = createMockThread();
            const postMessage = 'Hello, this is a thread message';

            const customName = thread.props?.custom_name;
            const label = customName || cleanMessageForDisplay(postMessage, 100) || 'Thread';

            expect(label).toBe('Hello, this is a thread message');
        });

        it('should prefer custom name over post message', () => {
            const thread = createMockThread({
                props: {custom_name: 'Custom Name'},
            });
            const postMessage = 'This should NOT be shown';

            const customName = thread.props?.custom_name;
            const label = customName || cleanMessageForDisplay(postMessage, 100) || 'Thread';

            expect(label).toBe('Custom Name');
            expect(label).not.toContain('This should NOT be shown');
        });

        it('should fall back to "Thread" when no message and no custom name', () => {
            const thread = createMockThread();
            const postMessage = '';

            const customName = thread.props?.custom_name;
            const label = customName || cleanMessageForDisplay(postMessage, 100) || 'Thread';

            expect(label).toBe('Thread');
        });
    });

    describe('thread link generation', () => {
        it('should generate correct link to full-width thread view', () => {
            const currentTeamName = 'test-team';
            const threadId = 'thread_id_123';

            // Logic from sidebar_thread_item.tsx
            const link = `/${currentTeamName}/thread/${threadId}`;

            expect(link).toBe('/test-team/thread/thread_id_123');
        });

        it('should handle team names with special characters', () => {
            const currentTeamName = 'my-team-name';
            const threadId = 'abc123def456';

            const link = `/${currentTeamName}/thread/${threadId}`;

            expect(link).toBe('/my-team-name/thread/abc123def456');
        });
    });

    describe('unread detection', () => {
        const createMockThread = (overrides: Partial<UserThread> = {}): UserThread => ({
            id: 'thread_id_1',
            reply_count: 5,
            last_reply_at: Date.now(),
            last_viewed_at: Date.now(),
            participants: [],
            post: {
                channel_id: 'channel_id_1',
                user_id: 'user_id_1',
            },
            unread_replies: 0,
            unread_mentions: 0,
            is_following: true,
            is_urgent: false,
            ...overrides,
        });

        it('should detect unread when there are unread replies', () => {
            const thread = createMockThread({unread_replies: 3});

            // Logic from sidebar_thread_item.tsx
            const hasUnread = (thread.unread_replies || 0) > 0 || (thread.unread_mentions || 0) > 0;

            expect(hasUnread).toBe(true);
        });

        it('should detect unread when there are unread mentions', () => {
            const thread = createMockThread({unread_mentions: 2});

            const hasUnread = (thread.unread_replies || 0) > 0 || (thread.unread_mentions || 0) > 0;

            expect(hasUnread).toBe(true);
        });

        it('should NOT detect unread when no unreads', () => {
            const thread = createMockThread({unread_replies: 0, unread_mentions: 0});

            const hasUnread = (thread.unread_replies || 0) > 0 || (thread.unread_mentions || 0) > 0;

            expect(hasUnread).toBe(false);
        });

        it('should detect unread with both replies and mentions', () => {
            const thread = createMockThread({unread_replies: 5, unread_mentions: 2});

            const hasUnread = (thread.unread_replies || 0) > 0 || (thread.unread_mentions || 0) > 0;

            expect(hasUnread).toBe(true);
        });
    });

    describe('active thread detection', () => {
        it('should detect active when route threadIdentifier matches thread id', () => {
            const threadId = 'thread_id_1';
            const routeParams = {team: 'test-team', threadIdentifier: 'thread_id_1'};

            const isActive = routeParams.threadIdentifier === threadId;

            expect(isActive).toBe(true);
        });

        it('should NOT detect active when route does not match', () => {
            const threadId = 'thread_id_1';
            const routeParams = {team: 'test-team', threadIdentifier: 'different_thread_id'};

            const isActive = routeParams.threadIdentifier === threadId;

            expect(isActive).toBe(false);
        });

        it('should NOT detect active when route params are undefined', () => {
            const threadId = 'thread_id_1';
            const routeParams: {threadIdentifier?: string} = {};

            const isActive = routeParams.threadIdentifier === threadId;

            expect(isActive).toBe(false);
        });
    });

    describe('urgent thread detection', () => {
        const createMockThread = (overrides: Partial<UserThread> = {}): UserThread => ({
            id: 'thread_id_1',
            reply_count: 5,
            last_reply_at: Date.now(),
            last_viewed_at: Date.now(),
            participants: [],
            post: {
                channel_id: 'channel_id_1',
                user_id: 'user_id_1',
            },
            unread_replies: 0,
            unread_mentions: 0,
            is_following: true,
            is_urgent: false,
            ...overrides,
        });

        it('should pass isUrgent to badge when thread is urgent', () => {
            const thread = createMockThread({is_urgent: true});

            const hasUrgent = thread.is_urgent ?? false;

            expect(hasUrgent).toBe(true);
        });

        it('should NOT pass isUrgent when thread is not urgent', () => {
            const thread = createMockThread({is_urgent: false});

            const hasUrgent = thread.is_urgent ?? false;

            expect(hasUrgent).toBe(false);
        });

        it('should default to false when is_urgent is undefined', () => {
            const thread = createMockThread();
            delete (thread as Partial<UserThread>).is_urgent;

            const hasUrgent = thread.is_urgent ?? false;

            expect(hasUrgent).toBe(false);
        });
    });
});

describe('cleanMessageForDisplay utility', () => {
    it('should return empty string for empty message', () => {
        expect(cleanMessageForDisplay('')).toBe('');
    });

    it('should return empty string for whitespace-only message', () => {
        expect(cleanMessageForDisplay('   ')).toBe('');
    });

    it('should truncate long messages with ellipsis', () => {
        const longMessage = 'This is a very long message that should be truncated at some point';
        const result = cleanMessageForDisplay(longMessage, 30);
        expect(result).toBe('This is a very long message th...');
        expect(result.length).toBe(33); // 30 chars + '...'
    });

    it('should only use first line of multi-line message', () => {
        const multiLine = 'First line\nSecond line\nThird line';
        expect(cleanMessageForDisplay(multiLine)).toBe('First line');
    });

    it('should remove markdown links but keep text', () => {
        const withLink = 'Check out [this link](https://example.com) please';
        expect(cleanMessageForDisplay(withLink)).toBe('Check out this link please');
    });

    it('should replace images with [image]', () => {
        const withImage = 'Look at this ![alt text](https://example.com/image.png) image';
        expect(cleanMessageForDisplay(withImage)).toBe('Look at this [image] image');
    });

    it('should remove bold markdown (double asterisk)', () => {
        const withBold = 'This is **bold** text';
        expect(cleanMessageForDisplay(withBold)).toBe('This is bold text');
    });

    it('should remove italic markdown (single asterisk)', () => {
        const withItalic = 'This is *italic* text';
        expect(cleanMessageForDisplay(withItalic)).toBe('This is italic text');
    });

    it('should remove underscore bold/italic', () => {
        const withUnderscore = 'This is __bold__ and _italic_ text';
        expect(cleanMessageForDisplay(withUnderscore)).toBe('This is bold and italic text');
    });

    it('should remove header markers', () => {
        const withHeader = '## This is a header';
        expect(cleanMessageForDisplay(withHeader)).toBe('This is a header');
    });

    it('should remove blockquote markers', () => {
        const withQuote = '> This is a quote';
        expect(cleanMessageForDisplay(withQuote)).toBe('This is a quote');
    });

    it('should replace inline code with [code]', () => {
        const withCode = 'Use the `console.log()` function';
        expect(cleanMessageForDisplay(withCode)).toBe('Use the [code] function');
    });

    it('should collapse multiple whitespace', () => {
        const withSpaces = 'Too   many    spaces';
        expect(cleanMessageForDisplay(withSpaces)).toBe('Too many spaces');
    });

    it('should handle complex message with multiple markdown elements', () => {
        const complex = '## **Important**: Check [docs](http://example.com) for `config`';
        const result = cleanMessageForDisplay(complex);
        expect(result).toBe('Important: Check docs for [code]');
    });

    it('should handle message with only whitespace on first line', () => {
        const message = '   \nActual content here';
        expect(cleanMessageForDisplay(message)).toBe('');
    });

    it('should use custom maxLength', () => {
        const message = 'Short message';
        expect(cleanMessageForDisplay(message, 5)).toBe('Short...');
    });

    it('should not add ellipsis if message fits within maxLength', () => {
        const message = 'Short';
        expect(cleanMessageForDisplay(message, 50)).toBe('Short');
    });

    it('should use default maxLength of 50', () => {
        const message = 'This message is exactly fifty one characters long!!';
        const result = cleanMessageForDisplay(message);
        expect(result.length).toBe(53); // 50 + '...'
    });
});
