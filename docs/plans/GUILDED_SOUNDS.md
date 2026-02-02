GuildedSounds Feature Implementation Plan

Overview

Add Guilded-style sounds for various user interactions, controlled by a feature flag and user preferences.

Sound Files

Convert these M4A files to MP3 (from C:\Users\Gamer\Music\SFX\Guilded):
- chat_message_sent.m4a → guilded_message_sent.mp3
- chat_reaction_apply.m4a → guilded_reaction_apply.mp3
- chat_reaction_received.m4a → guilded_reaction_received.mp3
- chat_message_received.m4a → guilded_message_received.mp3
- chat_dm_received.m4a → guilded_dm_received.mp3
- chat_mention_received.m4a → guilded_mention_received.mp3

Destination: webapp/channels/src/sounds/

Implementation Steps

1. Feature Flag (Server)

File: server/public/model/feature_flags.go
// Add after Encryption field (line ~101)
GuildedSounds bool

File: webapp/channels/src/components/admin_console/mattermost_extended_features.tsx
- Add 'GuildedSounds' to MATTERMOST_EXTENDED_FLAGS array

File: webapp/channels/src/components/admin_console/feature_flags.tsx
GuildedSounds: {
    description: 'Enable Guilded-style sounds for message/reaction interactions',
    defaultValue: false,
},

2. Add Sound Files

Convert and add to webapp/channels/src/sounds/:
- guilded_message_sent.mp3
- guilded_reaction_apply.mp3
- guilded_reaction_received.mp3
- guilded_message_received.mp3
- guilded_dm_received.mp3
- guilded_mention_received.mp3

3. Sound Utility

New file: webapp/channels/src/utils/guilded_sounds.tsx

// Imports
import guilded_message_sent from 'sounds/guilded_message_sent.mp3';
import guilded_reaction_apply from 'sounds/guilded_reaction_apply.mp3';
import guilded_reaction_received from 'sounds/guilded_reaction_received.mp3';
import guilded_message_received from 'sounds/guilded_message_received.mp3';
import guilded_dm_received from 'sounds/guilded_dm_received.mp3';
import guilded_mention_received from 'sounds/guilded_mention_received.mp3';

// Sound types
export type GuildedSoundType =
    | 'message_sent'
    | 'reaction_apply'
    | 'reaction_received'
    | 'message_received'
    | 'dm_received'
    | 'mention_received';

// Sound map
const guildedSounds = new Map([...]);

// Throttle state per sound type
const throttleState = new Map<GuildedSoundType, number>();

// Throttle intervals (ms)
const THROTTLE = {
    message_sent: 500,
    reaction_apply: 500,
    reaction_received: 2000,
    message_received: 1000,
    dm_received: 3000,
    mention_received: 3000,
};

// Main play function with throttling
export function playGuildedSound(type: GuildedSoundType): void;

// Convenience functions
export function playMessageSentSound(): void;
export function playReactionApplySound(): void;
export function playReactionReceivedSound(): void;
export function playMessageReceivedSound(type: 'channel' | 'dm' | 'mention'): void;

4. Preference Constants

File: webapp/channels/src/utils/constants.tsx (in Preferences object, around line 155)
// Add Guilded Sounds preferences
CATEGORY_GUILDED_SOUNDS: 'guilded_sounds',
GUILDED_SOUNDS_ENABLED: 'enabled',
GUILDED_SOUNDS_MESSAGE_SENT: 'message_sent',
GUILDED_SOUNDS_REACTION_APPLY: 'reaction_apply',
GUILDED_SOUNDS_REACTION_RECEIVED: 'reaction_received',
GUILDED_SOUNDS_MESSAGE_RECEIVED: 'message_received',

5. User Settings Component

New file: webapp/channels/src/components/user_settings/notifications/guilded_sounds_setting/index.tsx

Settings structure:
- Master toggle: "Enable Guilded Sounds"
- When enabled, show individual toggles:
- "Message sent sound" (default: on)
- "Reaction sound" (default: on)
- "Reaction received sound" (default: on)
- "Message received sound" (default: off - to avoid noise)

Preview buttons to test each sound.

6. Integrate Settings into Notifications Panel

File: webapp/channels/src/components/user_settings/notifications/user_settings_notifications.tsx
- Import GuildedSoundsSettings
- Add section after desktop notification sounds (only if feature flag enabled)

7. Sound Trigger Integration

File: webapp/channels/src/actions/post_actions.ts

In createPost (after line 151):
// After: const result = await dispatch(PostActions.createPost(post, files, afterSubmit));
// Add Guilded sound for message sent
if (isGuildedSoundsEnabled(getState)) {
    playMessageSentSound();
}

In addReaction (after line 263):
// After: const result = await dispatch(PostActions.addReaction(postId, emojiName));
// Add Guilded sound for reaction apply
if (isGuildedSoundsEnabled(getState) && !result.error) {
    playReactionApplySound();
}

File: webapp/channels/src/actions/websocket_actions.jsx

In handleReactionAddedEvent (around line 1360):
// After dispatching RECEIVED_REACTION, check if it's on current user's post
const currentUserId = getCurrentUserId(getState());
const post = getPost(getState(), reaction.post_id);
if (post && post.user_id === currentUserId && reaction.user_id !== currentUserId) {
    if (isGuildedSoundsEnabled(getState)) {
        playReactionReceivedSound();
    }
}

File: webapp/channels/src/actions/new_post.ts

In completePostReceive (around line 103):
- After notification logic, play received sound based on message type
- Skip if standard notification sound already played (check result.status)

// After sendDesktopNotification
if (isGuildedSoundsEnabled(getState) && status !== 'sent') {
    // Notification didn't play its sound, play guilded sound
    if (isDM) playMessageReceivedSound('dm');
    else if (isMention) playMessageReceivedSound('mention');
    else playMessageReceivedSound('channel');
}

8. Helper to Check Feature Flag + Preference

Add to: webapp/channels/src/utils/guilded_sounds.tsx
export function isGuildedSoundsEnabled(getState: () => GlobalState): boolean {
    const state = getState();
    const config = getConfig(state);
    if (config.FeatureFlagGuildedSounds !== 'true') return false;

    const enabled = getBool(state, Preferences.CATEGORY_GUILDED_SOUNDS, Preferences.GUILDED_SOUNDS_ENABLED, true);
    return enabled;
}

export function isGuildedSoundTypeEnabled(getState: () => GlobalState, type: GuildedSoundType): boolean {
    if (!isGuildedSoundsEnabled(getState)) return false;
    const state = getState();
    // Check individual toggle (default true for most, false for message_received)
    const defaultValue = type === 'message_received' ? false : true;
    return getBool(state, Preferences.CATEGORY_GUILDED_SOUNDS, type, defaultValue);
}

Files to Create

1. webapp/channels/src/utils/guilded_sounds.tsx - Sound utility
2. webapp/channels/src/components/user_settings/notifications/guilded_sounds_setting/index.tsx - Settings UI
3. 6 MP3 files in webapp/channels/src/sounds/

Files to Modify

1. server/public/model/feature_flags.go - Add GuildedSounds flag
2. webapp/channels/src/utils/constants.tsx - Add preference constants
3. webapp/channels/src/actions/post_actions.ts - Message sent + reaction apply sounds
4. webapp/channels/src/actions/websocket_actions.jsx - Reaction received sound
5. webapp/channels/src/actions/new_post.ts - Message/DM/mention received sounds
6. webapp/channels/src/components/user_settings/notifications/user_settings_notifications.tsx - Add settings section
7. webapp/channels/src/components/admin_console/mattermost_extended_features.tsx - Add to admin UI
8. webapp/channels/src/components/admin_console/feature_flags.tsx - Add flag metadata

Verification

1. Enable feature flag in System Console → Mattermost Extended → Features
2. Go to Settings → Notifications → Guilded Sounds
3. Enable sounds and test each:
- Send a message → hear sent sound
- Add a reaction → hear reaction sound
- Have another user react to your post → hear received sound
- Receive a message in a channel → hear received sound (if enabled)
- Receive a DM → hear DM sound
- Get @mentioned → hear mention sound
4. Disable individual sounds and verify they don't play
5. Disable master toggle and verify none play
6. Disable feature flag and verify settings don't appear