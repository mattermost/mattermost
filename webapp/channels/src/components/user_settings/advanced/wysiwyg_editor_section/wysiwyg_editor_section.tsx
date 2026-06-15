// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import type {PreferenceType} from '@mattermost/types/preferences';
import type {UserProfile} from '@mattermost/types/users';

import {getFeatureFlagValue} from 'mattermost-redux/selectors/entities/general';
import {get} from 'mattermost-redux/selectors/entities/preferences';

import SettingItem from 'components/setting_item';
import SettingItemMax from 'components/setting_item_max';

import {Preferences} from 'utils/constants';

import type {GlobalState} from 'types/store';

export type Actions = {
    savePreferences: (userId: string, preferences: PreferenceType[]) => void;
};

type Props = {
    active: boolean;
    areAllSectionsInactive: boolean;
    onUpdateSection: (section: string) => void;
    user: UserProfile;
    actions: Actions;
}

const WysiwygEditorSection: React.FC<Props> = ({active, areAllSectionsInactive, onUpdateSection, user, actions}) => {
    const wysiwygEditorFeatureFlag = useSelector((state: GlobalState) => getFeatureFlagValue(state, 'WysiwygEditor') === 'true');
    const wysiwygEditorPref = useSelector((state: GlobalState) => get(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.WYSIWYG_EDITOR, Preferences.WYSIWYG_EDITOR_DEFAULT));

    const [value, setValue] = useState<string>(wysiwygEditorPref);
    const [isSaving, setIsSaving] = useState<boolean>(false);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setValue(e.currentTarget.value);
    }, []);

    const handleUpdateSection = useCallback((section: string) => {
        setValue(wysiwygEditorPref);
        onUpdateSection(section);
    }, [onUpdateSection, wysiwygEditorPref]);

    const submitPreference = useCallback(() => {
        setIsSaving(true);
        const pref: PreferenceType = {
            user_id: user.id,
            category: Preferences.CATEGORY_DISPLAY_SETTINGS,
            name: Preferences.WYSIWYG_EDITOR,
            value,
        };
        actions.savePreferences(user.id, [pref]);
        setIsSaving(false);
        onUpdateSection('');
    }, [user.id, onUpdateSection, actions, value]);

    const changePreference = useCallback(() => {
        if (value === wysiwygEditorPref) {
            onUpdateSection('');
            return;
        }
        submitPreference();
    }, [wysiwygEditorPref, onUpdateSection, value, submitPreference]);

    if (!wysiwygEditorFeatureFlag) {
        return null;
    }

    if (active) {
        const options = [
            {
                option: 'true',
                inputId: 'wysiwygEditorOn',
                messageId: 'user.settings.advance.on',
                defaultMessage: 'On',
            },
            {
                option: 'false',
                inputId: 'wysiwygEditorOff',
                messageId: 'user.settings.advance.off',
                defaultMessage: 'Off',
            },
        ];

        const input = (
            <fieldset key='wysiwygEditorSetting'>
                <legend className='form-legend hidden-label'>
                    <FormattedMessage
                        id='user.settings.display.wysiwygEditorTitle'
                        defaultMessage='WYSIWYG Editor (Beta)'
                    />
                </legend>
                {options.map(({option, inputId, messageId, defaultMessage}) => (
                    <div
                        className='radio'
                        key={option}
                    >
                        <label>
                            <input
                                id={inputId}
                                type='radio'
                                name='wysiwygEditor'
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
                ))}
                <div className='mt-5'>
                    <FormattedMessage
                        id='user.settings.display.wysiwygEditorDesc'
                        defaultMessage='When enabled, the message editor uses a rich-text WYSIWYG mode with inline formatting preview instead of plain markdown input.'
                    />
                </div>
            </fieldset>
        );

        return (
            <SettingItemMax
                title={
                    <FormattedMessage
                        id='user.settings.display.wysiwygEditorTitle'
                        defaultMessage='WYSIWYG Editor (Beta)'
                    />
                }
                inputs={[input]}
                submit={changePreference}
                saving={isSaving}
                updateSection={handleUpdateSection}
                disableEnterSubmit={true}
            />
        );
    }

    return (
        <SettingItem
            active={false}
            areAllSectionsInactive={areAllSectionsInactive}
            title={
                <FormattedMessage
                    id='user.settings.display.wysiwygEditorTitle'
                    defaultMessage='WYSIWYG Editor (Beta)'
                />
            }
            describe={
                wysiwygEditorPref === 'true' ? (
                    <FormattedMessage
                        id='user.settings.advance.on'
                        defaultMessage='On'
                    />
                ) : (
                    <FormattedMessage
                        id='user.settings.advance.off'
                        defaultMessage='Off'
                    />
                )
            }
            section='wysiwygEditor'
            updateSection={handleUpdateSection}
            max={null}
        />
    );
};

export default WysiwygEditorSection;
