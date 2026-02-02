// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback, useEffect} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {PreferenceType} from '@mattermost/types/preferences';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {get} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import SettingDesktopHeader from '../headers/setting_desktop_header';
import SettingMobileHeader from '../headers/setting_mobile_header';

import {Preferences} from 'utils/constants';
import {
    setGuildedSoundsVolume,
    previewGuildedSound,
    type GuildedSoundType,
} from 'utils/guilded_sounds';

import type {GlobalState} from 'types/store';

import './user_settings_sounds.scss';

interface SoundSetting {
    type: GuildedSoundType;
    prefKey: string;
    titleId: string;
    titleDefault: string;
    descId: string;
    descDefault: string;
}

const SOUND_SETTINGS: SoundSetting[] = [
    {
        type: 'message_sent',
        prefKey: Preferences.GUILDED_SOUNDS_MESSAGE_SENT,
        titleId: 'user.settings.sounds.messageSent.title',
        titleDefault: 'Message Sent',
        descId: 'user.settings.sounds.messageSent.desc',
        descDefault: 'Play a sound when you send a message',
    },
    {
        type: 'reaction_apply',
        prefKey: Preferences.GUILDED_SOUNDS_REACTION_APPLY,
        titleId: 'user.settings.sounds.reactionApply.title',
        titleDefault: 'Reaction',
        descId: 'user.settings.sounds.reactionApply.desc',
        descDefault: 'Play a sound when you add a reaction',
    },
    {
        type: 'reaction_received',
        prefKey: Preferences.GUILDED_SOUNDS_REACTION_RECEIVED,
        titleId: 'user.settings.sounds.reactionReceived.title',
        titleDefault: 'Reaction Received',
        descId: 'user.settings.sounds.reactionReceived.desc',
        descDefault: 'Play a sound when someone reacts to your post',
    },
    {
        type: 'message_received',
        prefKey: Preferences.GUILDED_SOUNDS_MESSAGE_RECEIVED,
        titleId: 'user.settings.sounds.messageReceived.title',
        titleDefault: 'Message Received',
        descId: 'user.settings.sounds.messageReceived.desc',
        descDefault: 'Play a sound when a new message arrives in a channel',
    },
    {
        type: 'dm_received',
        prefKey: Preferences.GUILDED_SOUNDS_DM_RECEIVED,
        titleId: 'user.settings.sounds.dmReceived.title',
        titleDefault: 'Direct Message',
        descId: 'user.settings.sounds.dmReceived.desc',
        descDefault: 'Play a sound when you receive a direct message',
    },
    {
        type: 'mention_received',
        prefKey: Preferences.GUILDED_SOUNDS_MENTION_RECEIVED,
        titleId: 'user.settings.sounds.mentionReceived.title',
        titleDefault: 'Mention',
        descId: 'user.settings.sounds.mentionReceived.desc',
        descDefault: 'Play a sound when you are @mentioned',
    },
];

export interface Props {
    updateSection: (section: string) => void;
    activeSection: string;
    closeModal: () => void;
    collapseModal: () => void;
}

function UserSettingsSounds(props: Props): JSX.Element {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const currentUserId = useSelector(getCurrentUserId);

    // Get preferences from Redux
    const masterEnabled = useSelector((state: GlobalState) =>
        get(state, Preferences.CATEGORY_GUILDED_SOUNDS, Preferences.GUILDED_SOUNDS_ENABLED, 'true'),
    );
    const volumePref = useSelector((state: GlobalState) =>
        get(state, Preferences.CATEGORY_GUILDED_SOUNDS, Preferences.GUILDED_SOUNDS_VOLUME, '50'),
    );

    // Get individual sound preferences
    const soundPrefs = useSelector((state: GlobalState) => {
        const prefs: Record<string, string> = {};
        for (const setting of SOUND_SETTINGS) {
            prefs[setting.prefKey] = get(state, Preferences.CATEGORY_GUILDED_SOUNDS, setting.prefKey, 'true');
        }
        return prefs;
    });

    // Local state for editing
    const [volume, setVolume] = useState(parseInt(volumePref, 10) || 50);
    const [soundStates, setSoundStates] = useState<Record<string, boolean>>(() => {
        const states: Record<string, boolean> = {};
        for (const setting of SOUND_SETTINGS) {
            states[setting.prefKey] = soundPrefs[setting.prefKey] === 'true';
        }
        return states;
    });

    // Sync volume with preference when it changes
    useEffect(() => {
        const vol = parseInt(volumePref, 10) || 50;
        setVolume(vol);
        setGuildedSoundsVolume(vol / 100);
    }, [volumePref]);

    // Sync sound states with preferences when they change
    useEffect(() => {
        const states: Record<string, boolean> = {};
        for (const setting of SOUND_SETTINGS) {
            states[setting.prefKey] = soundPrefs[setting.prefKey] === 'true';
        }
        setSoundStates(states);
    }, [soundPrefs]);

    const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseInt(e.target.value, 10);
        setVolume(newVolume);
        setGuildedSoundsVolume(newVolume / 100);
    }, []);

    const handleVolumeSave = useCallback(async () => {
        const preferences: PreferenceType[] = [{
            user_id: currentUserId,
            category: Preferences.CATEGORY_GUILDED_SOUNDS,
            name: Preferences.GUILDED_SOUNDS_VOLUME,
            value: volume.toString(),
        }];
        await dispatch(savePreferences(currentUserId, preferences));
    }, [currentUserId, dispatch, volume]);

    const handleSoundToggle = useCallback(async (prefKey: string, enabled: boolean) => {
        setSoundStates((prev) => ({...prev, [prefKey]: enabled}));

        const preferences: PreferenceType[] = [{
            user_id: currentUserId,
            category: Preferences.CATEGORY_GUILDED_SOUNDS,
            name: prefKey,
            value: enabled.toString(),
        }];
        await dispatch(savePreferences(currentUserId, preferences));
    }, [currentUserId, dispatch]);

    const handlePreview = useCallback((soundType: GuildedSoundType) => {
        previewGuildedSound(soundType);
    }, []);

    const isMasterEnabled = masterEnabled === 'true';

    return (
        <div
            id='soundsSettings'
            aria-labelledby='soundsButton'
            role='tabpanel'
        >
            <SettingMobileHeader
                closeModal={props.closeModal}
                collapseModal={props.collapseModal}
                text={
                    <FormattedMessage
                        id='user.settings.sounds.title'
                        defaultMessage='Sounds'
                    />
                }
            />
            <div
                id='soundsTitle'
                className='user-settings'
            >
                <SettingDesktopHeader
                    text={
                        <FormattedMessage
                            id='user.settings.sounds.title'
                            defaultMessage='Sounds'
                        />
                    }
                />

                <div className='divider-dark first'/>

                {/* Volume Slider Section */}
                <div className='guilded-sounds-section'>
                    <div className='guilded-sounds-volume'>
                        <label
                            htmlFor='guilded-sounds-volume-slider'
                            className='guilded-sounds-label'
                        >
                            <FormattedMessage
                                id='user.settings.sounds.masterVolume'
                                defaultMessage='Master Volume'
                            />
                        </label>
                        <div className='guilded-sounds-volume-control'>
                            <input
                                id='guilded-sounds-volume-slider'
                                type='range'
                                min='0'
                                max='100'
                                value={volume}
                                onChange={handleVolumeChange}
                                onMouseUp={handleVolumeSave}
                                onTouchEnd={handleVolumeSave}
                                className='guilded-sounds-slider'
                            />
                            <span className='guilded-sounds-volume-value'>{volume}%</span>
                        </div>
                    </div>
                </div>

                <div className='divider-dark'/>

                {/* Sound Effects Section */}
                <div className='guilded-sounds-section'>
                    <h4 className='guilded-sounds-section-title'>
                        <FormattedMessage
                            id='user.settings.sounds.soundEffects'
                            defaultMessage='Sound Effects'
                        />
                    </h4>

                    {SOUND_SETTINGS.map((setting) => (
                        <div
                            key={setting.type}
                            className='guilded-sounds-item'
                        >
                            <div className='guilded-sounds-item-info'>
                                <div className='guilded-sounds-item-title'>
                                    <FormattedMessage
                                        id={setting.titleId}
                                        defaultMessage={setting.titleDefault}
                                    />
                                </div>
                                <div className='guilded-sounds-item-desc'>
                                    <FormattedMessage
                                        id={setting.descId}
                                        defaultMessage={setting.descDefault}
                                    />
                                </div>
                            </div>
                            <div className='guilded-sounds-item-controls'>
                                <label className='guilded-sounds-toggle'>
                                    <input
                                        type='checkbox'
                                        checked={soundStates[setting.prefKey]}
                                        onChange={(e) => handleSoundToggle(setting.prefKey, e.target.checked)}
                                        disabled={!isMasterEnabled}
                                    />
                                    <span className='guilded-sounds-toggle-slider'/>
                                </label>
                                <button
                                    type='button'
                                    className='guilded-sounds-preview-btn'
                                    onClick={() => handlePreview(setting.type)}
                                    title={formatMessage({id: 'user.settings.sounds.preview', defaultMessage: 'Preview'})}
                                >
                                    <i className='icon icon-play'/>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className='divider-dark'/>
            </div>
        </div>
    );
}

export default UserSettingsSounds;
