// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
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

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setValue(e.currentTarget.value);
    }, []);

    const submitPreference = useCallback(() => {
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
    }, [user.id, updateSection, actions, value]);

    const changePreference = useCallback(() => {
        if (value === renderEmoticonsAsEmoji) {
            updateSection('');
            return;
        }

        submitPreference();
    }, [renderEmoticonsAsEmoji, updateSection, value, submitPreference]);

    const options = [
        {
            option: 'true',
            inputId: 'renderEmoticonsAsEmojiOn',
            messageId: 'user.settings.advance.on',
            defaultMessage: 'On',
        },
        {
            option: 'false',
            inputId: 'renderEmoticonsAsEmojiOff',
            messageId: 'user.settings.advance.off',
            defaultMessage: 'Off',
        },
    ];

    const input = (
        <fieldset key='renderEmoticonsAsEmojiSetting'>
            <legend className='form-legend hidden-label'>
                <FormattedMessage
                    id='user.settings.display.renderEmoticonsAsEmojiTitle'
                    defaultMessage='Render emoticons as emojis'
                />
            </legend>
            {options.map(({option, inputId, messageId, defaultMessage}) => {
                return (
                    <div
                        className='radio'
                        key={option}
                    >
                        <label>
                            <input
                                id={inputId}
                                type='radio'
                                name='renderEmoticonsAsEmoji'
                                value={option}
                                checked={value === option}
                                onChange={handleChange}
                            />
                            <FormattedMessage
                                id={messageId}
                                defaultMessage={defaultMessage}
                            />
                        </label>
                        <br/>
                    </div>
                );
            })}
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
