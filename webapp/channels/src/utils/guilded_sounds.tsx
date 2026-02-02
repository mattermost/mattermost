// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {get} from 'mattermost-redux/selectors/entities/preferences';

import {Preferences} from 'utils/constants';

import type {GlobalState} from 'types/store';

// Import Guilded sounds
import guilded_message_sent from 'sounds/guilded_message_sent.mp3';
import guilded_reaction_apply from 'sounds/guilded_reaction_apply.mp3';
import guilded_reaction_received from 'sounds/guilded_reaction_received.mp3';
import guilded_message_received from 'sounds/guilded_message_received.mp3';
import guilded_dm_received from 'sounds/guilded_dm_received.mp3';
import guilded_mention_received from 'sounds/guilded_mention_received.mp3';

export type GuildedSoundType =
    | 'message_sent'
    | 'reaction_apply'
    | 'reaction_received'
    | 'message_received'
    | 'dm_received'
    | 'mention_received';

// Map sound types to their audio files
const guildedSounds = new Map<GuildedSoundType, string>([
    ['message_sent', guilded_message_sent],
    ['reaction_apply', guilded_reaction_apply],
    ['reaction_received', guilded_reaction_received],
    ['message_received', guilded_message_received],
    ['dm_received', guilded_dm_received],
    ['mention_received', guilded_mention_received],
]);

// Map sound types to their preference keys
const soundTypeToPreferenceKey: Record<GuildedSoundType, string> = {
    message_sent: Preferences.GUILDED_SOUNDS_MESSAGE_SENT,
    reaction_apply: Preferences.GUILDED_SOUNDS_REACTION_APPLY,
    reaction_received: Preferences.GUILDED_SOUNDS_REACTION_RECEIVED,
    message_received: Preferences.GUILDED_SOUNDS_MESSAGE_RECEIVED,
    dm_received: Preferences.GUILDED_SOUNDS_DM_RECEIVED,
    mention_received: Preferences.GUILDED_SOUNDS_MENTION_RECEIVED,
};

// Throttle intervals in milliseconds for each sound type
const THROTTLE_INTERVALS: Record<GuildedSoundType, number> = {
    message_sent: 500,
    reaction_apply: 500,
    reaction_received: 2000,
    message_received: 1000,
    dm_received: 3000,
    mention_received: 3000,
};

// Track last play time for each sound type
const lastPlayTimes: Record<GuildedSoundType, number> = {
    message_sent: 0,
    reaction_apply: 0,
    reaction_received: 0,
    message_received: 0,
    dm_received: 0,
    mention_received: 0,
};

// Global volume (0.0 - 1.0), default 50%
let globalVolume = 0.5;

/**
 * Set the global volume for all Guilded sounds
 * @param volume Volume level between 0.0 and 1.0
 */
export function setGuildedSoundsVolume(volume: number): void {
    globalVolume = Math.max(0, Math.min(1, volume));
}

/**
 * Get the current global volume for Guilded sounds
 * @returns Volume level between 0.0 and 1.0
 */
export function getGuildedSoundsVolume(): number {
    return globalVolume;
}

/**
 * Check if the GuildedSounds feature flag is enabled
 */
export function isGuildedSoundsEnabled(getState: () => GlobalState): boolean {
    const state = getState();
    const config = getConfig(state);
    return config.FeatureFlagGuildedSounds === 'true';
}

/**
 * Check if a specific sound type is enabled in user preferences
 */
export function isGuildedSoundTypeEnabled(getState: () => GlobalState, soundType: GuildedSoundType): boolean {
    const state = getState();

    // First check feature flag
    const config = getConfig(state);
    if (config.FeatureFlagGuildedSounds !== 'true') {
        return false;
    }

    // Check master enable preference (default: true when feature flag is on)
    const masterEnabled = get(state, Preferences.CATEGORY_GUILDED_SOUNDS, Preferences.GUILDED_SOUNDS_ENABLED, 'true');
    if (masterEnabled !== 'true') {
        return false;
    }

    // Check specific sound type preference (default: true)
    const prefKey = soundTypeToPreferenceKey[soundType];
    const soundEnabled = get(state, Preferences.CATEGORY_GUILDED_SOUNDS, prefKey, 'true');
    return soundEnabled === 'true';
}

/**
 * Get the user's volume preference
 */
export function getVolumeFromPreferences(getState: () => GlobalState): number {
    const state = getState();
    const volumeStr = get(state, Preferences.CATEGORY_GUILDED_SOUNDS, Preferences.GUILDED_SOUNDS_VOLUME, '50');
    const volume = parseInt(volumeStr, 10);
    return isNaN(volume) ? 50 : Math.max(0, Math.min(100, volume));
}

/**
 * Play a Guilded sound with throttling and volume control
 * @param soundType The type of sound to play
 */
export function playGuildedSound(soundType: GuildedSoundType): void {
    const now = Date.now();
    const lastPlay = lastPlayTimes[soundType];
    const throttleInterval = THROTTLE_INTERVALS[soundType];

    // Check throttle
    if (now - lastPlay < throttleInterval) {
        return;
    }

    // Update last play time
    lastPlayTimes[soundType] = now;

    // Get the sound file
    const soundFile = guildedSounds.get(soundType);
    if (!soundFile) {
        return;
    }

    // Create and play audio
    try {
        const audio = new Audio(soundFile);
        audio.volume = globalVolume;
        audio.play().catch(() => {
            // Audio play can fail due to autoplay policies
            // Silently ignore as user interaction hasn't occurred
        });
    } catch {
        // Ignore audio creation errors
    }
}

/**
 * Play a Guilded sound for preview (ignores throttle)
 */
export function previewGuildedSound(soundType: GuildedSoundType): void {
    const soundFile = guildedSounds.get(soundType);
    if (!soundFile) {
        return;
    }

    try {
        const audio = new Audio(soundFile);
        audio.volume = globalVolume;
        audio.play().catch(() => {
            // Ignore autoplay errors
        });
    } catch {
        // Ignore errors
    }
}
