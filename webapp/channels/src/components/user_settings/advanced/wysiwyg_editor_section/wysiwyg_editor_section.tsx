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
};

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
                option: 'false',
                inputId: 'wysiwygEditorMarkdown',
                messageId: 'user.settings.display.wysiwygEditor.markdown',
                defaultMessage: 'Markdown editing (default)',
            },
            {
                option: 'true',
                inputId: 'wysiwygEditorRich',
                messageId: 'user.settings.display.wysiwygEditor.richText',
                defaultMessage: 'Rich text editing (formatting appears as you type)',
            },
        ];

        const input = (
            <fieldset key='wysiwygEditorSetting'>
                <legend className='form-legend hidden-label'>
                    <FormattedMessage
                        id='user.settings.display.wysiwygEditorTitle'
                        defaultMessage='Rich text editing (Beta)'
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
                        defaultMessage='Choose how the message editor renders formatting. Markdown editing uses plain markdown syntax. Rich text editing shows inline formatting (bold, italic, headings, lists) as you type.'
                    />
                </div>
            </fieldset>
        );

        return (
            <SettingItemMax
                title={
                    <FormattedMessage
                        id='user.settings.display.wysiwygEditorTitle'
                        defaultMessage='Rich text editing (Beta)'
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
                    defaultMessage='Rich text editing (Beta)'
                />
            }
            describe={
                wysiwygEditorPref === 'true' ? (
                    <FormattedMessage
                        id='user.settings.display.wysiwygEditor.richText'
                        defaultMessage='Rich text editing (formatting appears as you type)'
                    />
                ) : (
                    <FormattedMessage
                        id='user.settings.display.wysiwygEditor.markdown'
                        defaultMessage='Markdown editing (default)'
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
