// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {Theme} from 'mattermost-redux/selectors/entities/preferences';
import {applyTheme} from 'utils/utils';

import {ActionFunc} from 'mattermost-redux/types/actions';

import {Preferences} from 'mattermost-redux/constants';

import SectionCreator from 'components/widgets/modals/components/modal_section';
import {PreferenceType} from '@mattermost/types/preferences';
import SaveChangesPanel from 'components/widgets/modals/components/save_changes_panel';
import CheckboxItemCreator from 'components/widgets/modals/components/checkbox_setting_item';

import PremadeThemeChooser from './premade_theme_chooser';

import {
    DarkThemeColorsSectionDesc,
    DarkThemeColorsSectionTitle,
    LightThemeColorsSectionDesc,
    LightThemeColorsSectionTitle,
    PreMadeDarkTheme,
    PreMadeLightTheme,
    SyncWithOsSectionDesc,
    SyncWithOsSectionInputFieldData,
    SyncWithOsSectionTitle,
    ThemeColorsSectionDesc,
    ThemeColorsSectionTitle,
    ThemeSettings,
} from './utils';

type Props = {
    currentUserId: string;
    teamId: string;
    theme: Theme;
    syncThemeWithOs: boolean;
    webLightTheme: Theme;
    webDarkTheme: Theme;
    savePreferences: (userId: string, preferences: PreferenceType[]) => Promise<{data: boolean}>;
    saveTheme: (teamId: string, theme: Theme) => Promise<{data: boolean}>;
}
type SettingsType = {
    [ThemeSettings.SYNC_THEME_WITH_OS]: boolean;
    [ThemeSettings.WEB_LIGHT_THEME]: Theme;
    [ThemeSettings.WEB_DARK_THEME]: Theme;
    [key: string]: boolean | string | undefined | Theme;
}

export default function UserSettingsThemes(props: Props): JSX.Element {
    const [haveChanges, setHaveChanges] = useState(false);
    const [currentTheme, setCurrentTheme] = useState(props.theme);

    const [settings, setSettings] = useState<SettingsType>({
        [ThemeSettings.SYNC_THEME_WITH_OS]: props.syncThemeWithOs,
        [ThemeSettings.WEB_LIGHT_THEME]: props.webLightTheme,
        [ThemeSettings.WEB_DARK_THEME]: props.webDarkTheme,
    });

    const handleChange = useCallback((values: Record<string, boolean | string | Theme>) => {
        console.log('handleChange', values);
        setSettings({...settings, ...values});
        setHaveChanges(true);
    }, [settings]);

    function handleCancel() {
        setSettings({
            [ThemeSettings.SYNC_THEME_WITH_OS]: props.syncThemeWithOs,
            [ThemeSettings.WEB_LIGHT_THEME]: props.webLightTheme,
            [ThemeSettings.WEB_DARK_THEME]: props.webDarkTheme,
        });
        setHaveChanges(false);
    }

    const handleSubmit = async (): Promise<void> => {
        const preferences: PreferenceType[] = [];
        const {savePreferences, currentUserId} = props;

        Object.keys(settings).forEach((setting) => {
            const category = Preferences.CATEGORY_THEME;
            preferences.push({
                user_id: currentUserId,
                category,
                name: setting,
                value: typeof settings[setting] === 'string' ? String(settings[setting]) : JSON.stringify(settings[setting]),
            });
        });

        await savePreferences(currentUserId, preferences);
        setHaveChanges(false);
        props.saveTheme(props.teamId, currentTheme);
    };

    const SyncWithOsSectionContent = (
        <>
            <CheckboxItemCreator
                inputFieldValue={settings[ThemeSettings.SYNC_THEME_WITH_OS]}
                inputFieldData={SyncWithOsSectionInputFieldData}
                handleChange={(e) => handleChange({[ThemeSettings.SYNC_THEME_WITH_OS]: e.target.value === 'true'})}
            />
        </>
    );

    const updateTheme = (newTheme: Theme): void => {
        let themeChanged = currentTheme.length === newTheme.length;
        if (!themeChanged) {
            for (const field in newTheme) {
                if (newTheme[field]) {
                    if (currentTheme[field] !== newTheme[field]) {
                        themeChanged = true;
                        break;
                    }
                }
            }
        }
        setCurrentTheme(newTheme);
        applyTheme(newTheme);
    };

    const PreMadeThemeContent = (
        <PremadeThemeChooser
            theme={props.theme}
            updateTheme={updateTheme}
        />
    );

    const PreMadeDarkThemeContent = (
        <PremadeThemeChooser
            themes={PreMadeDarkTheme}
            theme={settings[ThemeSettings.WEB_DARK_THEME]}
            updateTheme={(newTheme) => handleChange({[ThemeSettings.WEB_DARK_THEME]: newTheme})}
        />
    );

    const PreMadeLightThemeContent = (
        <PremadeThemeChooser
            themes={PreMadeLightTheme}
            theme={settings[ThemeSettings.WEB_LIGHT_THEME]}
            updateTheme={(newTheme) => handleChange({[ThemeSettings.WEB_LIGHT_THEME]: newTheme})}
        />
    );
    return (
        <>
            <SectionCreator
                title={SyncWithOsSectionTitle}
                content={SyncWithOsSectionContent}
                description={SyncWithOsSectionDesc}
            />
            { !settings[ThemeSettings.SYNC_THEME_WITH_OS] && <>
                <div className='user-settings-modal__divider'/>
                <SectionCreator
                    title={ThemeColorsSectionTitle}
                    content={PreMadeThemeContent}
                    description={ThemeColorsSectionDesc}
                />
            </>}
            { settings[ThemeSettings.SYNC_THEME_WITH_OS] && <>
                <div className='user-settings-modal__divider'/>
                <SectionCreator
                    title={LightThemeColorsSectionTitle}
                    content={PreMadeLightThemeContent}
                    description={LightThemeColorsSectionDesc}
                />
                <div className='user-settings-modal__divider'/>
                <SectionCreator
                    title={DarkThemeColorsSectionTitle}
                    content={PreMadeDarkThemeContent}
                    description={DarkThemeColorsSectionDesc}
                />
            </>}
            {haveChanges &&
                <SaveChangesPanel
                    handleSubmit={handleSubmit}
                    handleCancel={handleCancel}
                />
            }
        </>
    );
}
