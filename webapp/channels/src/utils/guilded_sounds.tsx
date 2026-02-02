// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {get} from 'mattermost-redux/selectors/entities/preferences';

import {Preferences} from 'utils/constants';

import type {GlobalState} from 'types/store';

// Import Guilded sounds
import guilded_message from 'sounds/guilded_message_received.mp3';
import guilded_reaction_apply from 'sounds/guilded_reaction_apply.mp3';
import guilded_reaction_received from 'sounds/guilded_reaction_received.mp3';
import guilded_dm_received from 'sounds/guilded_dm_received.mp3';
import guilded_mention_received from 'sounds/guilded_mention_received.mp3';
import guilded_typing from 'sounds/guilded_typing.mp3';

// Import notification sounds
import bing from 'sounds/bing.mp3';
import crackle from 'sounds/crackle.mp3';
import down from 'sounds/down.mp3';
import hello from 'sounds/hello.mp3';
import ripple from 'sounds/ripple.mp3';
import upstairs from 'sounds/upstairs.mp3';

// Sound event types (when sounds are triggered)
export type SoundEventType =
    | 'message_sent'
    | 'reaction_apply'
    | 'reaction_received'
    | 'message_received'
    | 'dm_received'
    | 'mention_received'
    | 'typing';

// All available sound IDs
export type SoundId =
    | 'none'
    | 'guilded_message'
    | 'guilded_reaction_apply'
    | 'guilded_reaction_received'
    | 'guilded_dm_received'
    | 'guilded_mention_received'
    | 'guilded_typing'
    | 'bing'
    | 'crackle'
    | 'down'
    | 'hello'
    | 'ripple'
    | 'upstairs';

// Map of all available sounds
export const ALL_SOUNDS: Map<SoundId, {file: string | null; label: string}> = new Map([
    ['none', {file: null, label: 'None'}],
    ['guilded_message', {file: guilded_message, label: 'Guilded - Message'}],
    ['guilded_reaction_apply', {file: guilded_reaction_apply, label: 'Guilded - Reaction'}],
    ['guilded_reaction_received', {file: guilded_reaction_received, label: 'Guilded - Reaction Received'}],
    ['guilded_dm_received', {file: guilded_dm_received, label: 'Guilded - DM Received'}],
    ['guilded_mention_received', {file: guilded_mention_received, label: 'Guilded - Mention'}],
    ['guilded_typing', {file: guilded_typing, label: 'Guilded - Typing'}],
    ['bing', {file: bing, label: 'Bing'}],
    ['crackle', {file: crackle, label: 'Crackle'}],
    ['down', {file: down, label: 'Down'}],
    ['hello', {file: hello, label: 'Hello'}],
    ['ripple', {file: ripple, label: 'Ripple'}],
    ['upstairs', {file: upstairs, label: 'Upstairs'}],
]);

// Get array of sound options for dropdowns
export function getSoundOptions(): Array<{value: SoundId; label: string}> {
    return Array.from(ALL_SOUNDS.entries()).map(([id, info]) => ({
        value: id,
        label: info.label,
    }));
}

// Default sounds for each event type
export const DEFAULT_SOUNDS: Record<SoundEventType, SoundId> = {
    message_sent: 'guilded_message',
    reaction_apply: 'guilded_reaction_apply',
    reaction_received: 'guilded_reaction_received',
    message_received: 'guilded_message',
    dm_received: 'guilded_dm_received',
    mention_received: 'guilded_mention_received',
    typing: 'guilded_typing',
};

// Map sound event types to their preference keys
const soundEventToPreferenceKey: Record<SoundEventType, string> = {
    message_sent: Preferences.GUILDED_SOUNDS_MESSAGE_SENT,
    reaction_apply: Preferences.GUILDED_SOUNDS_REACTION_APPLY,
    reaction_received: Preferences.GUILDED_SOUNDS_REACTION_RECEIVED,
    message_received: Preferences.GUILDED_SOUNDS_MESSAGE_RECEIVED,
    dm_received: Preferences.GUILDED_SOUNDS_DM_RECEIVED,
    mention_received: Preferences.GUILDED_SOUNDS_MENTION_RECEIVED,
    typing: Preferences.GUILDED_SOUNDS_TYPING,
};

// Throttle intervals in milliseconds for each sound event type
const THROTTLE_INTERVALS: Record<SoundEventType, number> = {
    message_sent: 500,
    reaction_apply: 500,
    reaction_received: 2000,
    message_received: 1000,
    dm_received: 3000,
    mention_received: 3000,
    typing: 3000,
};

// Track last play time for each sound event type
const lastPlayTimes: Record<SoundEventType, number> = {
    message_sent: 0,
    reaction_apply: 0,
    reaction_received: 0,
    message_received: 0,
    dm_received: 0,
    mention_received: 0,
    typing: 0,
};

// Global volume (0.0 - 1.0), default 100%
let globalVolume = 1.0;

// Track typing sound so it can be stopped
let typingAudio: HTMLAudioElement | null = null;

/**
 * Set the global volume for all sounds
 * @param volume Volume level between 0.0 and 1.0
 */
export function setGuildedSoundsVolume(volume: number): void {
    globalVolume = Math.max(0, Math.min(1, volume));
}

/**
 * Get the current global volume
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
 * Get the configured sound ID for an event type from user preferences
 */
export function getSoundForEvent(getState: () => GlobalState, eventType: SoundEventType): SoundId {
    const state = getState();

    // First check feature flag
    const config = getConfig(state);
    if (config.FeatureFlagGuildedSounds !== 'true') {
        return 'none';
    }

    // Get the preference value (could be 'true'/'false' for legacy, or a sound ID)
    const prefKey = soundEventToPreferenceKey[eventType];
    const prefValue = get(state, Preferences.CATEGORY_GUILDED_SOUNDS, prefKey, DEFAULT_SOUNDS[eventType]);

    // Handle legacy boolean preferences
    if (prefValue === 'true') {
        return DEFAULT_SOUNDS[eventType];
    }
    if (prefValue === 'false') {
        return 'none';
    }

    // Return the sound ID (or default if invalid)
    if (ALL_SOUNDS.has(prefValue as SoundId)) {
        return prefValue as SoundId;
    }

    return DEFAULT_SOUNDS[eventType];
}

/**
 * Check if a specific sound event is enabled (has a sound configured)
 */
export function isSoundEventEnabled(getState: () => GlobalState, eventType: SoundEventType): boolean {
    return getSoundForEvent(getState, eventType) !== 'none';
}

/**
 * Get the user's volume preference
 */
export function getVolumeFromPreferences(getState: () => GlobalState): number {
    const state = getState();
    const volumeStr = get(state, Preferences.CATEGORY_GUILDED_SOUNDS, Preferences.GUILDED_SOUNDS_VOLUME, '100');
    const volume = parseInt(volumeStr, 10);
    return isNaN(volume) ? 100 : Math.max(0, Math.min(100, volume));
}

/**
 * Play the configured sound for an event type with throttling
 */
export function playSoundForEvent(getState: () => GlobalState, eventType: SoundEventType): void {
    const soundId = getSoundForEvent(getState, eventType);
    if (soundId === 'none') {
        return;
    }

    const now = Date.now();
    const lastPlay = lastPlayTimes[eventType];
    const throttleInterval = THROTTLE_INTERVALS[eventType];

    // Check throttle
    if (now - lastPlay < throttleInterval) {
        return;
    }

    // Update last play time
    lastPlayTimes[eventType] = now;

    // Play the sound
    playSoundById(soundId);
}

/**
 * Play a sound by its ID
 */
export function playSoundById(soundId: SoundId): void {
    const soundInfo = ALL_SOUNDS.get(soundId);
    if (!soundInfo || !soundInfo.file) {
        return;
    }

    try {
        const audio = new Audio(soundInfo.file);
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
 * Preview a sound by its ID (ignores throttle)
 */
export function previewSound(soundId: SoundId): void {
    playSoundById(soundId);
}

// Legacy exports for backward compatibility
export type GuildedSoundType = SoundEventType;

export function isGuildedSoundTypeEnabled(getState: () => GlobalState, soundType: SoundEventType): boolean {
    return isSoundEventEnabled(getState, soundType);
}

export function playGuildedSound(getState: () => GlobalState, soundType: SoundEventType): void {
    playSoundForEvent(getState, soundType);
}

export function previewGuildedSound(soundType: SoundEventType): void {
    const soundId = DEFAULT_SOUNDS[soundType];
    previewSound(soundId);
}

/**
 * Play the typing sound (can be stopped with stopTypingSound)
 */
export function playTypingSound(getState: () => GlobalState): void {
    const soundId = getSoundForEvent(getState, 'typing');
    if (soundId === 'none') {
        return;
    }

    const now = Date.now();
    const lastPlay = lastPlayTimes.typing;
    const throttleInterval = THROTTLE_INTERVALS.typing;

    // Check throttle
    if (now - lastPlay < throttleInterval) {
        return;
    }

    // Update last play time
    lastPlayTimes.typing = now;

    // Stop any existing typing sound
    stopTypingSound();

    const soundInfo = ALL_SOUNDS.get(soundId);
    if (!soundInfo || !soundInfo.file) {
        return;
    }

    try {
        typingAudio = new Audio(soundInfo.file);
        typingAudio.volume = globalVolume;
        typingAudio.play().catch(() => {
            // Audio play can fail due to autoplay policies
        });
    } catch {
        // Ignore audio creation errors
    }
}

/**
 * Stop the typing sound if it's playing
 */
export function stopTypingSound(): void {
    if (typingAudio) {
        typingAudio.pause();
        typingAudio.currentTime = 0;
        typingAudio = null;
    }
}
