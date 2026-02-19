// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';

import {resolveDisplayMentionsToSlugs, convertSlugsToDisplayMentions, extractUnresolvedObfuscatedSlugs, hasObfuscatedSlug} from './channel_mention_utils';

function makeChannel(name: string, displayName: string): Channel {
    return {
        id: `id-${name}`,
        name,
        display_name: displayName,
        type: 'O',
        team_id: 'team1',
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        header: '',
        purpose: '',
        creator_id: '',
        scheme_id: '',
        group_constrained: false,
        last_post_at: 0,
        last_root_post_at: 0,
    } as Channel;
}

// 26-char alphanumeric strings to simulate obfuscated slugs
const OBFUSCATED_1 = 'abcdef1234567890abcdef1234'; // 26 chars
const OBFUSCATED_2 = 'ghijkl5678901234ghijkl5678'; // 26 chars
const OBFUSCATED_3 = 'mnopqr9012345678mnopqr9012'; // 26 chars

describe('hasObfuscatedSlug', () => {
    it('should return true for 26-char alphanumeric name that differs from display slug', () => {
        expect(hasObfuscatedSlug(makeChannel(OBFUSCATED_1, 'Town Square'))).toBe(true);
    });

    it('should return false for human-readable name matching display slug', () => {
        expect(hasObfuscatedSlug(makeChannel('town-square', 'Town Square'))).toBe(false);
    });

    it('should return false for custom name that is not 26-char alphanumeric', () => {
        expect(hasObfuscatedSlug(makeChannel('custom-slug', 'Engineering Updates'))).toBe(false);
    });

    it('should return false for name shorter than 26 chars', () => {
        expect(hasObfuscatedSlug(makeChannel('abc123', 'Some Channel'))).toBe(false);
    });

    it('should return false for name longer than 26 chars', () => {
        expect(hasObfuscatedSlug(makeChannel('abcdef1234567890abcdef12345', 'Some Channel'))).toBe(false);
    });

    it('should return false for 26-char name containing hyphens', () => {
        expect(hasObfuscatedSlug(makeChannel('abcdef-234567890abcdef1234', 'Some Channel'))).toBe(false);
    });
});

describe('resolveDisplayMentionsToSlugs', () => {
    const channels = [
        makeChannel(OBFUSCATED_1, 'Town Square'),
        makeChannel(OBFUSCATED_2, 'Off Topic'),
        makeChannel(OBFUSCATED_3, 'My Cool Channel'),
    ];

    it('should replace a single display slug with the real channel name', () => {
        const message = 'Check out ~town-square for updates';
        const result = resolveDisplayMentionsToSlugs(message, channels);
        expect(result).toBe(`Check out ~${OBFUSCATED_1} for updates`);
    });

    it('should replace multiple display slugs', () => {
        const message = 'See ~town-square and ~off-topic for info';
        const result = resolveDisplayMentionsToSlugs(message, channels);
        expect(result).toBe(`See ~${OBFUSCATED_1} and ~${OBFUSCATED_2} for info`);
    });

    it('should leave mentions that do not match any channel untouched', () => {
        const message = 'Check ~unknown-channel for updates';
        const result = resolveDisplayMentionsToSlugs(message, channels);
        expect(result).toBe('Check ~unknown-channel for updates');
    });

    it('should handle empty message', () => {
        expect(resolveDisplayMentionsToSlugs('', channels)).toBe('');
    });

    it('should handle message with no mentions', () => {
        const message = 'Hello world, no mentions here';
        expect(resolveDisplayMentionsToSlugs(message, channels)).toBe(message);
    });

    it('should handle empty channels list', () => {
        const message = 'Check ~town-square for updates';
        expect(resolveDisplayMentionsToSlugs(message, [])).toBe(message);
    });

    it('should handle collision by using first match', () => {
        const channelsWithCollision = [
            makeChannel(OBFUSCATED_1, 'My Channel'),
            makeChannel(OBFUSCATED_2, 'My Channel!'),
        ];
        // Both display names slugify to "my-channel"
        const message = 'See ~my-channel';
        const result = resolveDisplayMentionsToSlugs(message, channelsWithCollision);
        expect(result).toBe(`See ~${OBFUSCATED_1}`);
    });

    it('should not replace when channel name equals the display slug (non-obfuscated channel)', () => {
        const channelsWithReadableSlug = [
            makeChannel('town-square', 'Town Square'),
        ];
        const message = 'Check ~town-square';
        const result = resolveDisplayMentionsToSlugs(message, channelsWithReadableSlug);
        expect(result).toBe('Check ~town-square');
    });

    it('should not alter channels with customized names that are not 26-char alphanumeric', () => {
        const channelsWithCustomName = [
            makeChannel('custom-slug', 'Engineering Updates'),
        ];
        const message = 'Check ~engineering-updates for updates';
        const result = resolveDisplayMentionsToSlugs(message, channelsWithCustomName);
        expect(result).toBe('Check ~engineering-updates for updates');
    });

    it('should only transform obfuscated channels in a mixed set', () => {
        const mixedChannels = [
            makeChannel('town-square', 'Town Square'),           // non-obfuscated - skip
            makeChannel(OBFUSCATED_1, 'Engineering'),            // obfuscated - transform
        ];
        const message = 'See ~town-square and ~engineering';
        const result = resolveDisplayMentionsToSlugs(message, mixedChannels);
        expect(result).toBe(`See ~town-square and ~${OBFUSCATED_1}`);
    });

    it('should handle mentions at start and end of message', () => {
        const message = '~town-square is great, also check ~my-cool-channel';
        const result = resolveDisplayMentionsToSlugs(message, channels);
        expect(result).toBe(`~${OBFUSCATED_1} is great, also check ~${OBFUSCATED_3}`);
    });

    it('should handle null/undefined message', () => {
        expect(resolveDisplayMentionsToSlugs(null as unknown as string, channels)).toBe(null);
        expect(resolveDisplayMentionsToSlugs(undefined as unknown as string, channels)).toBe(undefined);
    });
});

describe('convertSlugsToDisplayMentions', () => {
    const channels = [
        makeChannel(OBFUSCATED_1, 'Town Square'),
        makeChannel(OBFUSCATED_2, 'Off Topic'),
        makeChannel(OBFUSCATED_3, 'My Cool Channel'),
    ];

    it('should replace a real channel name with the display slug', () => {
        const message = `Check out ~${OBFUSCATED_1} for updates`;
        const result = convertSlugsToDisplayMentions(message, channels);
        expect(result).toBe('Check out ~town-square for updates');
    });

    it('should replace multiple real channel names', () => {
        const message = `See ~${OBFUSCATED_1} and ~${OBFUSCATED_2} for info`;
        const result = convertSlugsToDisplayMentions(message, channels);
        expect(result).toBe('See ~town-square and ~off-topic for info');
    });

    it('should leave mentions that do not match any channel untouched', () => {
        const message = 'Check ~unknown-slug for updates';
        const result = convertSlugsToDisplayMentions(message, channels);
        expect(result).toBe('Check ~unknown-slug for updates');
    });

    it('should not replace when name and display slug are the same (non-obfuscated channel)', () => {
        const channelsWithReadableSlug = [
            makeChannel('town-square', 'Town Square'),
        ];
        const message = 'Check ~town-square';
        const result = convertSlugsToDisplayMentions(message, channelsWithReadableSlug);
        expect(result).toBe('Check ~town-square');
    });

    it('should not alter channels with customized names that are not 26-char alphanumeric', () => {
        const channelsWithCustomName = [
            makeChannel('custom-slug', 'Engineering Updates'),
        ];
        const message = 'Check ~custom-slug';
        const result = convertSlugsToDisplayMentions(message, channelsWithCustomName);
        expect(result).toBe('Check ~custom-slug');
    });

    it('should only transform obfuscated channels in a mixed set', () => {
        const mixedChannels = [
            makeChannel('town-square', 'Town Square'),           // non-obfuscated - skip
            makeChannel(OBFUSCATED_1, 'Engineering'),            // obfuscated - transform
        ];
        const message = `See ~town-square and ~${OBFUSCATED_1}`;
        const result = convertSlugsToDisplayMentions(message, mixedChannels);
        expect(result).toBe('See ~town-square and ~engineering');
    });

    it('should handle empty message', () => {
        expect(convertSlugsToDisplayMentions('', channels)).toBe('');
    });

    it('should handle null/undefined message', () => {
        expect(convertSlugsToDisplayMentions(null as unknown as string, channels)).toBe(null);
        expect(convertSlugsToDisplayMentions(undefined as unknown as string, channels)).toBe(undefined);
    });

    it('should be the inverse of resolveDisplayMentionsToSlugs', () => {
        const original = 'Check ~town-square and ~off-topic';
        const resolved = resolveDisplayMentionsToSlugs(original, channels);
        expect(resolved).toBe(`Check ~${OBFUSCATED_1} and ~${OBFUSCATED_2}`);
        const restored = convertSlugsToDisplayMentions(resolved, channels);
        expect(restored).toBe(original);
    });
});

describe('extractUnresolvedObfuscatedSlugs', () => {
    const channels = [
        makeChannel(OBFUSCATED_1, 'Town Square'),
        makeChannel(OBFUSCATED_2, 'Off Topic'),
    ];

    it('should return empty array for empty message', () => {
        expect(extractUnresolvedObfuscatedSlugs('', channels)).toEqual([]);
    });

    it('should return empty array when all obfuscated slugs are known', () => {
        const message = `Check ~${OBFUSCATED_1} and ~${OBFUSCATED_2}`;
        expect(extractUnresolvedObfuscatedSlugs(message, channels)).toEqual([]);
    });

    it('should return unresolved obfuscated slugs', () => {
        const message = `Check ~${OBFUSCATED_1} and ~${OBFUSCATED_3}`;
        expect(extractUnresolvedObfuscatedSlugs(message, channels)).toEqual([OBFUSCATED_3]);
    });

    it('should ignore non-obfuscated slugs', () => {
        const message = 'Check ~town-square and ~general';
        expect(extractUnresolvedObfuscatedSlugs(message, channels)).toEqual([]);
    });

    it('should deduplicate repeated unresolved slugs', () => {
        const message = `~${OBFUSCATED_3} and ~${OBFUSCATED_3} again`;
        expect(extractUnresolvedObfuscatedSlugs(message, channels)).toEqual([OBFUSCATED_3]);
    });

    it('should return empty array when message has no mentions', () => {
        expect(extractUnresolvedObfuscatedSlugs('Hello world', channels)).toEqual([]);
    });

    it('should return empty array for null/undefined message', () => {
        expect(extractUnresolvedObfuscatedSlugs(null as unknown as string, channels)).toEqual([]);
        expect(extractUnresolvedObfuscatedSlugs(undefined as unknown as string, channels)).toEqual([]);
    });
});
