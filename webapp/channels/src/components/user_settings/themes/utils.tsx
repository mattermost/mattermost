// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import {t} from 'utils/i18n';

import {Theme, ThemeKey} from 'mattermost-redux/selectors/entities/preferences';
import {Preferences} from 'mattermost-redux/constants';

import {FieldsetCheckbox} from 'components/widgets/modals/components/checkbox_setting_item';

export const PreMadeLightTheme: Partial<Record<ThemeKey, Theme>> = {
    denim: Preferences.THEMES.denim,
    sapphire: Preferences.THEMES.sapphire,
    quartz: Preferences.THEMES.quartz,
};

export const PreMadeDarkTheme: Partial<Record<ThemeKey, Theme>> = {
    indigo: Preferences.THEMES.indigo,
    onyx: Preferences.THEMES.onyx,
};

export enum ThemeSettings {
    SYNC_THEME_WITH_OS='sync_theme_with_os',
    WEB_DARK_THEME='web_dark_theme',
    WEB_LIGHT_THEME='web_light_theme',
}

export const SyncWithOsSectionTitle = {
    id: t('user.settings.themes.syncWithOs.title'),
    defaultMessage: 'Sync with OS appearance',
};

export const SyncWithOsSectionDesc = {
    id: t('user.settings.themes.syncWithOs.desc'),
    defaultMessage: 'Automatically switch between light and dark themes when your system does. ',
};

export const SyncWithOsSectionInputFieldData: FieldsetCheckbox = {
    title: {
        id: t('user.settings.themes.syncWithOs.input'),
        defaultMessage: 'Sync with OS appearance',
    },
    name: 'syncWithOs',
    dataTestId: 'syncWithOs',
};

export const ThemeColorsSectionTitle = {
    id: t('user.settings.themes.themeColors.title'),
    defaultMessage: 'Theme colors',
};

export const ThemeColorsSectionDesc = {
    id: t('user.settings.themes.themeColors.desc'),
    defaultMessage: 'Choose a theme from the options below or',
};

export const LightThemeColorsSectionTitle = {
    id: t('user.settings.themes.lightTheme.title'),
    defaultMessage: 'Light theme',
};

export const LightThemeColorsSectionDesc = {
    id: t('user.settings.themes.lightTheme.desc'),
    defaultMessage: 'Choose a light theme from the options below or',
};

export const DarkThemeColorsSectionTitle = {
    id: t('user.settings.themes.darkTheme.title'),
    defaultMessage: 'Dark theme',
};

export const DarkThemeColorsSectionDesc = {
    id: t('user.settings.themes.darkTheme.desc'),
    defaultMessage: 'Choose a dark theme from the options below or',
};
