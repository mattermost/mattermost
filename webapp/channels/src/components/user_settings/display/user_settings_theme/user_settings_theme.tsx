// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {RefObject} from 'react';
import {FormattedMessage} from 'react-intl';

import type {Theme} from 'mattermost-redux/selectors/entities/preferences';

import ExternalLink from 'components/external_link';
import SettingItemMax from 'components/setting_item_max';
import SettingItemMin from 'components/setting_item_min';
import type SettingItemMinComponent from 'components/setting_item_min';

import {Constants} from 'utils/constants';
import {initializeSystemThemeDetection, isSystemInDarkMode} from 'utils/theme_utils';
import {applyTheme} from 'utils/utils';

import type {ModalData} from 'types/actions';

import CustomThemeChooser from './custom_theme_chooser/custom_theme_chooser';
import PremadeThemeChooser from './premade_theme_chooser';

type Props = {
    currentTeamId: string;
    theme: Theme;
    darkTheme?: Theme;
    themeAutoSwitch: boolean;
    selected: boolean;
    areAllSectionsInactive: boolean;
    updateSection: (section: string) => void;
    setRequireConfirm?: (requireConfirm: boolean) => void;
    allowCustomThemes: boolean;
    showAllTeamsCheckbox: boolean;
    applyToAllTeams: boolean;
    actions: {
        saveTheme: (teamId: string, theme: Theme) => void;
        saveDarkTheme: (teamId: string, theme: Theme) => void;
        saveThemeAutoSwitch: (value: boolean) => void;
        deleteTeamSpecificThemes: () => void;
        openModal: <P>(modalData: ModalData<P>) => void;
    };
};

type State = {
    isSaving: boolean;
    type: string;
    darkType: string;
    showAllTeamsCheckbox: boolean;
    applyToAllTeams: boolean;
    serverError: string;
    theme: Theme;
    darkTheme: Theme;
    themeAutoSwitch: boolean;
};

export default class ThemeSetting extends React.PureComponent<Props, State> {
    minRef: RefObject<SettingItemMinComponent>;
    originalTheme: Theme;
    originalDarkTheme: Theme;
    originalThemeAutoSwitch: boolean;

    constructor(props: Props) {
        super(props);

        this.state = {
            ...this.getStateFromProps(props),
            isSaving: false,
            serverError: '',
        };

        this.originalTheme = Object.assign({}, this.state.theme);
        this.originalDarkTheme = Object.assign({}, this.state.darkTheme);
        this.originalThemeAutoSwitch = this.state.themeAutoSwitch;
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
        if (this.props.selected) {
            applyTheme(this.props.theme);
        }
    }

    getStateFromProps(props = this.props): State {
        const theme = {...props.theme};
        if (!theme.codeTheme) {
            theme.codeTheme = Constants.DEFAULT_CODE_THEME;
        }

        const darkTheme = props.darkTheme ? {...props.darkTheme} : {...theme};
        if (!darkTheme.codeTheme) {
            darkTheme.codeTheme = Constants.DEFAULT_CODE_THEME;
        }

        return {
            theme,
            darkTheme,
            type: theme.type || 'premade',
            darkType: darkTheme.type || 'premade',
            showAllTeamsCheckbox: props.showAllTeamsCheckbox,
            applyToAllTeams: props.applyToAllTeams,
            themeAutoSwitch: props.themeAutoSwitch,
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

        await this.props.actions.saveTheme(teamId, this.state.theme);
        await this.props.actions.saveThemeAutoSwitch(this.state.themeAutoSwitch);
        if (this.state.themeAutoSwitch) {
            await this.props.actions.saveDarkTheme(teamId, this.state.darkTheme);
        }

        // Apply the appropriate theme based on system preference when auto-switch is enabled
        if (isSystemInDarkMode() && this.state.themeAutoSwitch) {
            applyTheme(this.state.darkTheme);
        } else {
            applyTheme(this.state.theme);
        }

        if (this.state.applyToAllTeams) {
            await this.props.actions.deleteTeamSpecificThemes();
        }

        this.props.setRequireConfirm?.(false);
        this.originalTheme = Object.assign({}, this.state.theme);
        this.originalDarkTheme = Object.assign({}, this.state.darkTheme);
        this.originalThemeAutoSwitch = this.state.themeAutoSwitch;
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

        // Only apply the light theme immediately if auto-switch is disabled or system is in light mode
        if (!this.state.themeAutoSwitch || !isSystemInDarkMode()) {
            applyTheme(theme);
        }
    };

    updateDarkTheme = (darkTheme: Theme): void => {
        let themeChanged = this.state.darkTheme.length === darkTheme.length;
        if (!themeChanged) {
            for (const field in darkTheme) {
                if (Object.hasOwn(darkTheme, field)) {
                    if (this.state.darkTheme[field] !== darkTheme[field]) {
                        themeChanged = true;
                        break;
                    }
                }
            }
        }

        this.props.setRequireConfirm?.(themeChanged);

        this.setState({darkTheme});

        // Apply the dark theme immediately if we're in dark mode and auto-switch is enabled
        if (this.state.themeAutoSwitch && isSystemInDarkMode()) {
            applyTheme(darkTheme);
        }
    };

    updateType = (type: string): void => this.setState({type});

    updateDarkType = (darkType: string): void => this.setState({darkType});

    toggleThemeAutoSwitch = (): void => {
        const themeAutoSwitch = !this.state.themeAutoSwitch;
        this.setState({themeAutoSwitch});
        this.props.setRequireConfirm?.(this.originalThemeAutoSwitch !== themeAutoSwitch);

        // If auto-switch is being enabled, initialize the system theme detection
        // and apply the appropriate theme based on the system preference
        if (themeAutoSwitch) {
            initializeSystemThemeDetection();

            // Apply the appropriate theme immediately based on the current system preference
            if (isSystemInDarkMode() && this.state.darkTheme) {
                applyTheme(this.state.darkTheme);
            } else {
                applyTheme(this.state.theme);
            }
        } else {
            // If auto-switch is being disabled, revert to the light theme
            applyTheme(this.state.theme);
        }
    };

    resetFields = (): void => {
        const state = this.getStateFromProps();
        state.serverError = '';
        this.setState(state);

        applyTheme(isSystemInDarkMode() ? state.darkTheme : state.theme);

        this.props.setRequireConfirm?.(false);
    };

    handleUpdateSection = (section: string): void => this.props.updateSection(section);

    render() {
        let serverError;
        if (this.state.serverError) {
            serverError = this.state.serverError;
        }

        const displayCustom = this.state.type === 'custom';
        const displayDarkCustom = this.state.darkType === 'custom';

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

        // Dark theme components
        let darkCustom;
        let darkPremade;
        if (displayDarkCustom && this.props.allowCustomThemes) {
            darkCustom = (
                <div key='customDarkThemeChooser'>
                    <CustomThemeChooser
                        theme={this.state.darkTheme}
                        updateTheme={this.updateDarkTheme}
                    />
                </div>
            );
        } else {
            darkPremade = (
                <div key='premadeDarkThemeChooser'>
                    <br/>
                    <PremadeThemeChooser
                        theme={this.state.darkTheme}
                        updateTheme={this.updateDarkTheme}
                    />
                </div>
            );
        }

        let themeUI;
        if (this.props.selected) {
            const inputs = [];

            // Auto-switch toggle
            inputs.push(
                <div
                    className='checkbox'
                    key='themeAutoSwitchCheckbox'
                >
                    <label>
                        <input
                            id='themeAutoSwitch'
                            type='checkbox'
                            checked={this.state.themeAutoSwitch}
                            onChange={this.toggleThemeAutoSwitch}
                        />
                        <FormattedMessage
                            id='user.settings.display.theme.autoSwitch'
                            defaultMessage='Automatically switch between light and dark themes'
                        />
                    </label>
                    <br/>
                    <br/>
                </div>,
            );

            // Light theme section header
            inputs.push(
                <div key='lightThemeHeader'>
                    <h4>
                        {this.state.themeAutoSwitch ? (
                            <FormattedMessage
                                id='user.settings.display.theme.lightTheme'
                                defaultMessage='Light Theme'
                            />
                        ) : (
                            <FormattedMessage
                                id='user.settings.display.theme.title'
                                defaultMessage='Theme'
                            />
                        )}
                    </h4>
                </div>,
            );

            if (this.props.allowCustomThemes) {
                inputs.push(
                    <div
                        key='premadeCustom'
                        className='user-settings__radio-group-inline'
                    >
                        <div className='radio radio-inline'>
                            <label>
                                <input
                                    id='standardThemes'
                                    type='radio'
                                    name='theme'
                                    checked={!displayCustom}
                                    onChange={this.updateType.bind(this, 'premade')}
                                />
                                <FormattedMessage
                                    id='user.settings.display.theme.premadeThemes'
                                    defaultMessage='Premade Themes'
                                />
                            </label>
                        </div>
                        <div className='radio radio-inline'>
                            <label>
                                <input
                                    id='customThemes'
                                    type='radio'
                                    name='theme'
                                    checked={displayCustom}
                                    onChange={this.updateType.bind(this, 'custom')}
                                />
                                <FormattedMessage
                                    id='user.settings.display.theme.customTheme'
                                    defaultMessage='Custom Theme'
                                />
                            </label>
                        </div>
                    </div>,
                );

                inputs.push(premade, custom);
            }

            // Dark theme section (only shown when auto-switch is enabled)
            if (this.state.themeAutoSwitch) {
                inputs.push(
                    <div key='darkThemeHeader'>
                        <h4>
                            <FormattedMessage
                                id='user.settings.display.theme.darkTheme'
                                defaultMessage='Dark Theme'
                            />
                        </h4>
                    </div>,
                );

                if (this.props.allowCustomThemes) {
                    inputs.push(
                        <div
                            className='radio radio-inline'
                            key='premadeDarkThemeColorLabel'
                        >
                            <label>
                                <input
                                    id='standardDarkThemes'
                                    type='radio'
                                    name='darkTheme'
                                    checked={!displayDarkCustom}
                                    onChange={this.updateDarkType.bind(this, 'premade')}
                                    aria-controls='premadeDarkThemesSection'
                                />
                                <FormattedMessage
                                    id='user.settings.display.theme.premadeThemes'
                                    defaultMessage='Premade Themes'
                                />
                            </label>
                        </div>,
                    );
                }

                if (this.props.allowCustomThemes) {
                    inputs.push(
                        <div
                            className='radio radio-inline'
                            key='customDarkThemeColorLabel'
                        >
                            <label>
                                <input
                                    id='customDarkThemes'
                                    type='radio'
                                    name='darkTheme'
                                    checked={displayDarkCustom}
                                    onChange={this.updateDarkType.bind(this, 'custom')}
                                    aria-controls='customDarkThemesSection'
                                />
                                <FormattedMessage
                                    id='user.settings.display.theme.customTheme'
                                    defaultMessage='Custom Theme'
                                />
                            </label>
                        </div>,
                    );

                    inputs.push(darkPremade, darkCustom);
                }
            }

            // Add "See other themes" link after both light and dark theme sections
            if (this.props.allowCustomThemes) {
                inputs.push(
                    <div key='otherThemes'>
                        <br/>
                        <ExternalLink
                            id='otherThemes'
                            href='http://docs.mattermost.com/help/settings/theme-colors.html#custom-theme-examples'
                            location='user_settings_theme'
                        >
                            <FormattedMessage
                                id='user.settings.display.theme.otherThemes'
                                defaultMessage='See other themes'
                            />
                        </ExternalLink>
                    </div>,
                );
            }

            let allTeamsCheckbox = null;
            if (this.state.showAllTeamsCheckbox) {
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
