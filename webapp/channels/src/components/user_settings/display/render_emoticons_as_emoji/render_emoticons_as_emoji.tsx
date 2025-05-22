// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {FormattedMessage} from 'react-intl';

import type {PreferencesType, PreferenceType} from '@mattermost/types/preferences';
import type {UserProfile} from '@mattermost/types/users';

import {Preferences} from 'mattermost-redux/constants';

import SettingItemMax from 'components/setting_item_max';

export type Actions = {
    savePreferences: (userId: string, preferences: PreferenceType[]) => void;
};

export type OwnProps = {
    user: UserProfile;
    updateSection: (section: string) => void;
    adminMode?: boolean;
    userPreferences?: PreferencesType;
}

type Props = OwnProps & {
    renderEmoticonsAsEmoji: string;
    actions: Actions;
}

const RenderEmoticonsAsEmoji: React.FC<Props> = ({user, renderEmoticonsAsEmoji, updateSection, actions}) => {
    const [value, setValue] = useState<string>(renderEmoticonsAsEmoji);
    const [isSaving, setIsSaving] = useState<boolean>(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setValue(e.currentTarget.value);
    };

    const submitPreference = () => {
        setIsSaving(true);
        const pref: PreferenceType = {
            user_id: user.id,
            category: Preferences.CATEGORY_DISPLAY_SETTINGS,
            name: Preferences.RENDER_EMOTICONS_AS_EMOJI,
            value,
        };
        actions.savePreferences(user.id, [pref]);
        setIsSaving(false);
        updateSection('');
    };

    const changePreference = () => {
        if (value === renderEmoticonsAsEmoji) {
            updateSection('');
            return;
        }

        submitPreference();
    };

    const input = (
        <fieldset key='renderEmoticonsAsEmojiSetting'>
            <legend className='form-legend hidden-label'>
                <FormattedMessage
                    id='user.settings.display.renderEmoticonsAsEmojiTitle'
                    defaultMessage='Render emoticons as emojis'
                />
            </legend>
            {['true', 'false'].map((v) => (
                <div
                    className='radio'
                    key={v}
                >
                    <label>
                        <input
                            id={v === 'true' ? 'renderEmoticonsAsEmojiOn' : 'renderEmoticonsAsEmojiOff'}
                            type='radio'
                            name='renderEmoticonsAsEmoji'
                            value={v}
                            checked={value === v}
                            onChange={handleChange}
                        />
                        <FormattedMessage
                            id={v === 'true' ? 'user.settings.advance.on' : 'user.settings.advance.off'}
                            defaultMessage={v === 'true' ? 'On' : 'Off'}
                        />
                    </label>
                    <br/>
                </div>
            ))}
            <div className='mt-5'>
                <FormattedMessage
                    id='user.settings.display.renderEmoticonsAsEmojiDesc'
                    defaultMessage='When enabled, text emoticons in messages will be rendered as emojis (For example :D as 😄)'
                />
            </div>
        </fieldset>
    );

    return (
        <SettingItemMax
            title={
                <FormattedMessage
                    id='user.settings.display.renderEmoticonsAsEmojiTitle'
                    defaultMessage='Render emoticons as emojis'
                />
            }
            inputs={[input]}
            submit={changePreference}
            saving={isSaving}
            updateSection={updateSection}
            disableEnterSubmit={true}
        />
    );
};

export default RenderEmoticonsAsEmoji;
