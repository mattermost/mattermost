GuildedSounds Feature Implementation Plan

Overview

Add Guilded-style sounds for various user interactions, with a new "Sounds" settings category where users can enable/disable sounds and adjust volume.

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
// ... etc

export type GuildedSoundType =
    | 'message_sent'
    | 'reaction_apply'
    | 'reaction_received'
    | 'message_received'
    | 'dm_received'
    | 'mention_received';

// Sound map
const guildedSounds = new Map([...]);

// Throttle intervals (ms)
const THROTTLE = {
    message_sent: 500,
    reaction_apply: 500,
    reaction_received: 2000,
    message_received: 1000,
    dm_received: 3000,
    mention_received: 3000,
};

// Global volume (0.0 - 1.0)
let globalVolume = 0.5;
export function setGuildedSoundsVolume(volume: number): void;
export function getGuildedSoundsVolume(): number;

// Play with throttling and volume
export function playGuildedSound(type: GuildedSoundType): void;

// Helper to check if enabled
export function isGuildedSoundsEnabled(getState: () => GlobalState): boolean;
export function isGuildedSoundTypeEnabled(getState: () => GlobalState, type: GuildedSoundType): boolean;

4. Preference Constants

File: webapp/channels/src/utils/constants.tsx (in Preferences object, around line 155)
// Add Guilded Sounds preferences
CATEGORY_GUILDED_SOUNDS: 'guilded_sounds',
GUILDED_SOUNDS_ENABLED: 'enabled',
GUILDED_SOUNDS_VOLUME: 'volume',
GUILDED_SOUNDS_MESSAGE_SENT: 'message_sent',
GUILDED_SOUNDS_REACTION_APPLY: 'reaction_apply',
GUILDED_SOUNDS_REACTION_RECEIVED: 'reaction_received',
GUILDED_SOUNDS_MESSAGE_RECEIVED: 'message_received',
GUILDED_SOUNDS_DM_RECEIVED: 'dm_received',
GUILDED_SOUNDS_MENTION_RECEIVED: 'mention_received',

5. New "Sounds" Settings Tab

Add a new top-level settings tab between "Sidebar" and "Advanced".

File: webapp/channels/src/components/user_settings/modal/user_settings_modal.tsx

In getUserSettingsTabs() (line ~260), add after sidebar tab:
// Only show if feature flag is enabled
{
    name: 'sounds',
    uiName: formatMessage({id: 'user.settings.modal.sounds', defaultMessage: 'Sounds'}),
    icon: 'icon icon-volume-high',
    iconTitle: formatMessage({id: 'user.settings.sounds.icon', defaultMessage: 'Sounds Settings Icon'}),
},

Note: This tab should only appear when FeatureFlagGuildedSounds === 'true'. We'll need to pass config to the modal or filter tabs.

File: webapp/channels/src/components/user_settings/index.tsx

Add import and case:
import SoundsTab from './sounds';

// In the function, add:
} else if (props.activeTab === 'sounds') {
    return (
        <div>
            <SoundsTab
                user={props.user}
                activeSection={props.activeSection}
                updateSection={props.updateSection}
                closeModal={props.closeModal}
                collapseModal={props.collapseModal}
            />
        </div>
    );
}

6. Sounds Tab Component

New directory: webapp/channels/src/components/user_settings/sounds/

New file: webapp/channels/src/components/user_settings/sounds/index.ts
export {default} from './user_settings_sounds';

New file: webapp/channels/src/components/user_settings/sounds/user_settings_sounds.tsx

Structure:
Sounds Settings
├── Master Volume Slider (0-100%)
├── Sound Toggles Section:
│   ├── Message Sent Sound [toggle] [preview]
│   ├── Reaction Sound [toggle] [preview]
│   ├── Reaction Received Sound [toggle] [preview]
│   ├── Message Received Sound [toggle] [preview]
│   ├── DM Received Sound [toggle] [preview]
│   └── Mention Sound [toggle] [preview]

Each setting:
- Toggle on/off
- Preview button to test the sound
- Uses preferences to persist

7. Sound Trigger Integration

File: webapp/channels/src/actions/post_actions.ts

In createPost (after line 151):
// After: const result = await dispatch(PostActions.createPost(post, files, afterSubmit));
if (isGuildedSoundTypeEnabled(getState, 'message_sent')) {
    playGuildedSound('message_sent');
}

In addReaction (after line 263):
// After: const result = await dispatch(PostActions.addReaction(postId, emojiName));
if (!result.error && isGuildedSoundTypeEnabled(getState, 'reaction_apply')) {
    playGuildedSound('reaction_apply');
}

File: webapp/channels/src/actions/websocket_actions.jsx

In handleReactionAddedEvent (around line 1360):
const currentUserId = getCurrentUserId(getState());
const post = getPost(getState(), reaction.post_id);
if (post && post.user_id === currentUserId && reaction.user_id !== currentUserId) {
    if (isGuildedSoundTypeEnabled(getState, 'reaction_received')) {
        playGuildedSound('reaction_received');
    }
}

File: webapp/channels/src/actions/new_post.ts

In completePostReceive (around line 103):
// After sendDesktopNotification - play guilded sound based on message type
// Only if notification didn't play (to avoid double sounds)
const state = getState();
if (status !== 'sent') {
    // Determine message type
    const channel = getChannel(state, post.channel_id);
    const isDM = channel?.type === Constants.DM_CHANNEL;
    const mentions = msgProps.mentions ? JSON.parse(msgProps.mentions) : [];
    const isMention = mentions.includes(currentUserId);

    if (isMention && isGuildedSoundTypeEnabled(() => state, 'mention_received')) {
        playGuildedSound('mention_received');
    } else if (isDM && isGuildedSoundTypeEnabled(() => state, 'dm_received')) {
        playGuildedSound('dm_received');
    } else if (isGuildedSoundTypeEnabled(() => state, 'message_received')) {
        playGuildedSound('message_received');
    }
}

8. Conditional Tab Display

File: webapp/channels/src/components/user_settings/modal/user_settings_modal.tsx

Need to pass config and filter tabs based on feature flags:

Option A: Connect modal to Redux for config
Option B: Filter tabs in getUserSettingsTabs() based on global config

Preferred: Option B - Use getConfig from store at render time.

getUserSettingsTabs = () => {
    const {formatMessage} = this.props.intl;
    const config = getConfig(store.getState()); // Import store

    const tabs = [
        { name: 'notifications', ... },
        { name: 'display', ... },
        { name: 'sidebar', ... },
    ];

    // Add Sounds tab if feature flag enabled
    if (config.FeatureFlagGuildedSounds === 'true') {
        tabs.push({
            name: 'sounds',
            uiName: formatMessage({id: 'user.settings.modal.sounds', defaultMessage: 'Sounds'}),
            icon: 'icon icon-volume-high',
            iconTitle: formatMessage({id: 'user.settings.sounds.icon', defaultMessage: 'Sounds Settings Icon'}),
        });
    }

    tabs.push({ name: 'advanced', ... });

    return tabs;
};

Files to Create

1. webapp/channels/src/utils/guilded_sounds.tsx - Sound utility with volume control
2. webapp/channels/src/components/user_settings/sounds/index.ts - Export
3. webapp/channels/src/components/user_settings/sounds/user_settings_sounds.tsx - Main component
4. 6 MP3 files in webapp/channels/src/sounds/

Files to Modify

1. server/public/model/feature_flags.go - Add GuildedSounds flag
2. webapp/channels/src/utils/constants.tsx - Add preference constants
3. webapp/channels/src/components/user_settings/index.tsx - Add sounds tab case
4. webapp/channels/src/components/user_settings/modal/user_settings_modal.tsx - Add sounds to tab list
5. webapp/channels/src/actions/post_actions.ts - Message sent + reaction apply sounds
6. webapp/channels/src/actions/websocket_actions.jsx - Reaction received sound
7. webapp/channels/src/actions/new_post.ts - Message/DM/mention received sounds
8. webapp/channels/src/components/admin_console/mattermost_extended_features.tsx - Add to admin UI
9. webapp/channels/src/components/admin_console/feature_flags.tsx - Add flag metadata

Settings UI Mockup

┌─────────────────────────────────────────────────────────────┐
│ Sounds                                                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Master Volume                                                │
│ ├────────────────●───────────────┤ 50%                      │
│                                                              │
│ ─────────────────────────────────────────────────────────── │
│                                                              │
│ Sound Effects                                                │
│                                                              │
│ Message Sent                          [●] On    [▶ Preview] │
│ Play a sound when you send a message                        │
│                                                              │
│ Reaction                              [●] On    [▶ Preview] │
│ Play a sound when you add a reaction                        │
│                                                              │
│ Reaction Received                     [●] On    [▶ Preview] │
│ Play a sound when someone reacts to your post               │
│                                                              │
│ Message Received                      [○] Off   [▶ Preview] │
│ Play a sound when a new message arrives in a channel        │
│                                                              │
│ Direct Message                        [●] On    [▶ Preview] │
│ Play a sound when you receive a direct message              │
│                                                              │
│ Mention                               [●] On    [▶ Preview] │
│ Play a sound when you are @mentioned                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘

Verification

1. Enable feature flag in System Console → Mattermost Extended → Features → GuildedSounds
2. Verify "Sounds" tab appears in Settings (between Sidebar and Advanced)
3. Go to Settings → Sounds
4. Test volume slider - sounds should play at adjusted volume
5. Test each sound toggle and preview:
- Send a message → hear sent sound
- Add a reaction → hear reaction sound
- Have another user react to your post → hear received sound
- Receive a message in a channel → hear received sound (if enabled)
- Receive a DM → hear DM sound
- Get @mentioned → hear mention sound
6. Disable individual sounds and verify they don't play
7. Disable feature flag and verify Sounds tab disappears