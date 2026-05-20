// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {RefObject} from 'react';
import {FormattedMessage} from 'react-intl';

import type {PreferenceType} from '@mattermost/types/preferences';
import {Preferences} from 'mattermost-redux/constants';
import type {Theme} from 'mattermost-redux/selectors/entities/preferences';

import ExternalLink from 'components/external_link';
import SettingItemMax from 'components/setting_item_max';
import SettingItemMin from 'components/setting_item_min';
import type SettingItemMinComponent from 'components/setting_item_min';

import {Constants} from 'utils/constants';
import {applyTheme} from 'utils/utils';

import type {ModalData} from 'types/actions';

import CustomThemeChooser from './custom_theme_chooser/custom_theme_chooser';
import PremadeThemeChooser from './premade_theme_chooser';

type Props = {
    currentTeamId: string;
    currentUserId: string;
    theme: Theme;
    selected: boolean;
    areAllSectionsInactive: boolean;
    updateSection: (section: string) => void;
    setRequireConfirm?: (requireConfirm: boolean) => void;
    allowCustomThemes: boolean;
    showAllTeamsCheckbox: boolean;
    applyToAllTeams: boolean;
    syncWithOS: boolean;
    actions: {
        saveTheme: (teamId: string, theme: Theme) => void;
        deleteTeamSpecificThemes: () => void;
        openModal: <P>(modalData: ModalData<P>) => void;
        savePreferences: (userId: string, preferences: PreferenceType[]) => void;
    };
};

type State = {
    isSaving: boolean;
    type: string;
    showAllTeamsCheckbox: boolean;
    applyToAllTeams: boolean;
    serverError: string;
    theme: Theme;
    syncWithOS: boolean;
};

export default class ThemeSetting extends React.PureComponent<Props, State> {
    minRef: RefObject<SettingItemMinComponent>;
    originalTheme: Theme;

    constructor(props: Props) {
        super(props);

        this.state = {
            ...this.getStateFromProps(props),
            isSaving: false,
            serverError: '',
        };

        this.originalTheme = Object.assign({}, this.state.theme);
        this.minRef = React.createRef();
    }

    componentDidUpdate(prevProps: Props) {
        if (prevProps.selected && !this.props.selected) {
            this.resetFields();
        }
        if (prevProps.selected && !this.props.selected && this.props.areAllSectionsInactive) {
            this.focusEditButton();
        }
    }

    componentWillUnmount() {
        // Skip theme restoration when OS sync is on — ThemeProvider owns the theme.
        if (this.props.selected && !this.props.syncWithOS) {
            applyTheme(this.props.theme);
        }
    }

    getStateFromProps(props = this.props): State {
        const theme = {...props.theme};
        if (!theme.codeTheme) {
            theme.codeTheme = Constants.DEFAULT_CODE_THEME;
        }

        return {
            theme,
            type: theme.type || 'premade',
            showAllTeamsCheckbox: props.showAllTeamsCheckbox,
            applyToAllTeams: props.applyToAllTeams,
            syncWithOS: props.syncWithOS,
            serverError: '',
            isSaving: false,
        };
    }

    focusEditButton(): void {
        this.minRef.current?.focus();
    }

    submitTheme = async (): Promise<void> => {
        const teamId = this.state.applyToAllTeams ? '' : this.props.currentTeamId;

        this.setState({isSaving: true});

        // Save the OS-sync preference first.
        const syncPref: PreferenceType = {
            user_id: this.props.currentUserId,
            category: Preferences.CATEGORY_DISPLAY_SETTINGS,
            name: Preferences.NAME_THEME_SYNC_WITH_OS,
            value: this.state.syncWithOS ? 'true' : 'false',
        };
        this.props.actions.savePreferences(this.props.currentUserId, [syncPref]);

        // Only save the selected theme when sync-with-OS is off.
        if (!this.state.syncWithOS) {
            await this.props.actions.saveTheme(teamId, this.state.theme);

            if (this.state.applyToAllTeams) {
                await this.props.actions.deleteTeamSpecificThemes();
            }
        }

        this.props.setRequireConfirm?.(false);
        this.originalTheme = Object.assign({}, this.state.theme);
        this.props.updateSection('');
        this.setState({isSaving: false});
    };

    updateTheme = (theme: Theme): void => {
        let themeChanged = this.state.theme.length === theme.length;
        if (!themeChanged) {
            for (const field in theme) {
                if (Object.hasOwn(theme, field)) {
                    if (this.state.theme[field] !== theme[field]) {
                        themeChanged = true;
                        break;
                    }
                }
            }
        }

        this.props.setRequireConfirm?.(themeChanged);

        this.setState({theme});
        applyTheme(theme);
    };

    updateType = (type: string): void => this.setState({type});

    handleSyncWithOSChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        this.setState({syncWithOS: e.target.checked});
        this.props.setRequireConfirm?.(true);
    };

    resetFields = (): void => {
        const state = this.getStateFromProps();
        state.serverError = '';
        this.setState(state);

        // Skip theme restoration when OS sync is on — ThemeProvider owns the theme.
        if (!this.props.syncWithOS) {
            applyTheme(state.theme);
        }

        this.props.setRequireConfirm?.(false);
    };

    handleUpdateSection = (section: string): void => this.props.updateSection(section);

    render() {
        let serverError;
        if (this.state.serverError) {
            serverError = this.state.serverError;
        }

        const displayCustom = this.state.type === 'custom';

        let custom;
        let premade;
        if (displayCustom && this.props.allowCustomThemes) {
            custom = (
                <div key='customThemeChooser'>
                    <CustomThemeChooser
                        theme={this.state.theme}
                        updateTheme={this.updateTheme}
                    />
                </div>
            );
        } else {
            premade = (
                <div key='premadeThemeChooser'>
                    <br/>
                    <PremadeThemeChooser
                        theme={this.state.theme}
                        updateTheme={this.updateTheme}
                    />
                </div>
            );
        }

        let themeUI;
        if (this.props.selected) {
            const inputs = [];

            // ── Sync with OS checkbox ──────────────────────────────────────
            inputs.push(
                <div
                    key='syncWithOS'
                    className='checkbox'
                    style={{marginBottom: '12px'}}
                >
                    <label>
                        <input
                            id='syncWithOSTheme'
                            type='checkbox'
                            checked={this.state.syncWithOS}
                            onChange={this.handleSyncWithOSChange}
                        />
                        <FormattedMessage
                            id='user.settings.display.theme.syncWithOS'
                            defaultMessage='Sync with OS dark/light mode'
                        />
                    </label>
                    <div className='help-text'>
                        <FormattedMessage
                            id='user.settings.display.theme.syncWithOS.description'
                            defaultMessage='Automatically switch to Onyx in dark mode and your chosen theme in light mode based on your OS appearance setting.'
                        />
                    </div>
                </div>,
            );

            // Theme selection is managed by the administrator — only OS sync is available.
            inputs.push(
                <div
                    key='themeLockedNotice'
                    className='help-text'
                    style={{marginBottom: '8px'}}
                >
                    <FormattedMessage
                        id='user.settings.display.theme.adminManaged'
                        defaultMessage='The colour theme is set by your administrator. You can choose whether it follows your OS dark/light mode above.'
                    />
                </div>,
            );

            let allTeamsCheckbox = null;
            if (this.state.showAllTeamsCheckbox && !this.state.syncWithOS) {
                allTeamsCheckbox = (
                    <div className='checkbox user-settings__submit-checkbox'>
                        <label>
                            <input
                                id='applyThemeToAllTeams'
                                type='checkbox'
                                checked={this.state.applyToAllTeams}
                                onChange={(e) => this.setState({applyToAllTeams: e.target.checked})}
                            />
                            <FormattedMessage
                                id='user.settings.display.theme.applyToAllTeams'
                                defaultMessage='Apply new theme to all my teams'
                            />
                        </label>
                    </div>
                );
            }

            themeUI = (
                <SettingItemMax
                    title={
                        <FormattedMessage
                            id='user.settings.display.theme.title'
                            defaultMessage='Theme'
                        />
                    }
                    inputs={
                        <fieldset>
                            <legend className='hidden-label'>
                                <FormattedMessage
                                    id='user.settings.display.theme.title'
                                    defaultMessage='Theme'
                                />
                            </legend>
                            <div>
                                {inputs}
                            </div>
                        </fieldset>
                    }
                    submitExtra={allTeamsCheckbox}
                    submit={this.submitTheme}
                    disableEnterSubmit={true}
                    saving={this.state.isSaving}
                    serverError={serverError}
                    isFullWidth={true}
                    updateSection={this.handleUpdateSection}
                />
            );
        } else {
            themeUI = (
                <SettingItemMin
                    title={
                        <FormattedMessage
                            id='user.settings.display.theme.title'
                            defaultMessage='Theme'
                        />
                    }
                    describe={
                        <FormattedMessage
                            id='user.settings.display.theme.describe'
                            defaultMessage='Open to manage your theme'
                        />
                    }
                    section={'theme'}
                    updateSection={this.handleUpdateSection}
                    ref={this.minRef}
                />
            );
        }

        return themeUI;
    }
}
