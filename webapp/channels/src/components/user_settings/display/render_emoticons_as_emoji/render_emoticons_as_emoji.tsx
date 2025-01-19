// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useRef, useEffect} from 'react';
import type {ReactNode} from 'react';
import {FormattedMessage} from 'react-intl';

import type {PreferencesType, PreferenceType} from '@mattermost/types/preferences';

import {Preferences} from 'mattermost-redux/constants';

import SettingItemMax from 'components/setting_item_max';
import SettingItemMin from 'components/setting_item_min';
import type SettingItemMinComponent from 'components/setting_item_min';

import {a11yFocus} from 'utils/utils';

export type OwnProps = {
    adminMode?: boolean;
    userId: string;
    userPreferences?: PreferencesType;
}

type Props = OwnProps & {
    active: boolean;
    areAllSectionsInactive: boolean;
    renderEmoticonsAsEmoji: string;
    updateSection: (section: string) => void;
    renderOnOffLabel: (label: string) => ReactNode;
    actions: {
        savePreferences: (userId: string, preferences: PreferenceType[]) => void;
    };
}

const RenderEmoticonsAsEmoji: React.FC<Props> = ({userId, active, areAllSectionsInactive, renderEmoticonsAsEmoji, updateSection, renderOnOffLabel, actions}) => {
    const [renderEmoticonsAsEmojiState, setRenderEmoticonsAsEmojiState] = useState<string>(renderEmoticonsAsEmoji);

    const [isSaving] = useState<boolean>(false);

    const minRef = useRef<SettingItemMinComponent>(null);

    const focusEditButton = () => {
        minRef.current?.focus();
    };

    useEffect(() => {
        if (!active && areAllSectionsInactive) {
            focusEditButton();
        }
    }, [active, areAllSectionsInactive]);

    const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setRenderEmoticonsAsEmojiState(e.currentTarget.value);
        a11yFocus(e.currentTarget);
    };

    const handleUpdateSection = (section: string) => {
        const renderEmoticonsAsEmojiPreference = {
            user_id: userId,
            category: Preferences.CATEGORY_DISPLAY_SETTINGS,
            name: Preferences.RENDER_EMOTICONS_AS_EMOJI,
            value: renderEmoticonsAsEmojiState,
        };
        if (!section) {
            actions.savePreferences(userId, [renderEmoticonsAsEmojiPreference]);
        }
        updateSection(section);
    };

    const handleSubmit = () => {
        const renderEmoticonsAsEmojiPreference = {
            user_id: userId,
            category: Preferences.CATEGORY_DISPLAY_SETTINGS,
            name: Preferences.RENDER_EMOTICONS_AS_EMOJI,
            value: renderEmoticonsAsEmojiState,
        };
        actions.savePreferences(userId, [renderEmoticonsAsEmojiPreference]);
        updateSection('');
    };

    if (active) {
        return (
            <SettingItemMax
                title={
                    <FormattedMessage
                        id='user.settings.display.renderEmoticonsAsEmojiTitle'
                        defaultMessage='Render emoticons as emojis'
                    />
                }
                inputs={[
                    <fieldset key='renderEmoticonsAsEmojiSetting'>
                        <legend className='form-legend hidden-label'>
                            <FormattedMessage
                                id='user.settings.display.renderEmoticonsAsEmojiTitle'
                                defaultMessage='Render emoticons as emojis'
                            />
                        </legend>
                        <div className='radio'>
                            <label>
                                <input
                                    id='renderEmoticonsAsEmojiOn'
                                    type='radio'
                                    value='true'
                                    name='renderEmoticonsAsEmoji'
                                    checked={renderEmoticonsAsEmojiState === 'true'}
                                    onChange={handleOnChange}
                                />
                                <FormattedMessage
                                    id='user.settings.advance.on'
                                    defaultMessage='On'
                                />
                            </label>
                            <br/>
                        </div>
                        <div className='radio'>
                            <label>
                                <input
                                    id='renderEmoticonsAsEmojiOff'
                                    type='radio'
                                    value='false'
                                    name='renderEmoticonsAsEmoji'
                                    checked={renderEmoticonsAsEmojiState === 'false'}
                                    onChange={handleOnChange}
                                />
                                <FormattedMessage
                                    id='user.settings.advance.off'
                                    defaultMessage='Off'
                                />
                            </label>
                            <br/>
                        </div>
                        <div className='mt-5'>
                            <FormattedMessage
                                id='user.settings.display.renderEmoticonsAsEmojiDesc'
                                defaultMessage='When enabled, text emoticons in messages will automatically be rendered as emojis (For example :D as 😄)'
                            />
                        </div>
                    </fieldset>,
                ]}
                setting='renderEmoticonsAsEmoji'
                submit={handleSubmit}
                saving={isSaving}
                serverError={undefined}
                updateSection={handleUpdateSection}
            />
        );
    }

    return (
        <SettingItemMin
            title={
                <FormattedMessage
                    id='user.settings.display.renderEmoticonsAsEmojiTitle'
                    defaultMessage='Render emoticons as emojis'
                />
            }
            describe={renderOnOffLabel(renderEmoticonsAsEmoji)}
            section='renderEmoticonsAsEmoji'
            updateSection={handleUpdateSection}
            ref={minRef}
        />
    );
};

export default RenderEmoticonsAsEmoji;
