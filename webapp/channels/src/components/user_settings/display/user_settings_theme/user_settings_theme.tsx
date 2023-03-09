// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {RefObject} from 'react';

import {FormattedMessage} from 'react-intl';

import SettingItemMax from 'components/setting_item_max';
import SettingItemMin from 'components/setting_item_min';
import SettingItemMinComponent from 'components/setting_item_min/setting_item_min';

import {Theme} from 'mattermost-redux/selectors/entities/preferences';

import ImportThemeModal from 'components/user_settings/import_theme_modal';

import {Constants, ModalIdentifiers} from 'utils/constants';
import {applyTheme} from 'utils/utils';

import {ModalData} from 'types/actions';

import ExternalLink from 'components/external_link';

import CustomThemeChooser from './custom_theme_chooser/custom_theme_chooser';
import PremadeThemeChooser from './premade_theme_chooser';

type Props = {
    currentTeamId: string;
    theme: Theme;
    selected: boolean;
    areAllSectionsInactive: boolean;
    updateSection: (section: string) => void;
    setRequireConfirm?: (requireConfirm: boolean) => void;
    setEnforceFocus?: (enforceFocus: boolean) => void;
    allowCustomThemes: boolean;
    showAllTeamsCheckbox: boolean;
    applyToAllTeams: boolean;
    actions: {
        saveTheme: (teamId: string, theme: Theme) => void;
        deleteTeamSpecificThemes: () => void;
        openModal: <P>(modalData: ModalData<P>) => void;
    };
};

type State = {
    isSaving: boolean;
    type: string;
    showAllTeamsCheckbox: boolean;
    applyToAllTeams: boolean;
    serverError: string;
    theme: Theme;
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
        if (this.props.selected) {
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

        if (this.state.applyToAllTeams) {
            await this.props.actions.deleteTeamSpecificThemes();
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
                if (theme.hasOwnProperty(field)) {
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

    resetFields = (): void => {
        const state = this.getStateFromProps();
        state.serverError = '';
        this.setState(state);

        applyTheme(state.theme);

        this.props.setRequireConfirm?.(false);
    };

    handleImportModal = (): void => {
        this.props.actions.openModal({
            modalId: ModalIdentifiers.IMPORT_THEME_MODAL,
            dialogType: ImportThemeModal,
            dialogProps: {
                callback: this.updateTheme,
            },
        });

        this.props.setEnforceFocus?.(false);
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

            if (this.props.allowCustomThemes) {
                inputs.push(
                    <div
                        className='radio'
                        key='premadeThemeColorLabel'
                    >
                        <label>
                            <input
                                id='standardThemes'
                                type='radio'
                                name='theme'
                                checked={!displayCustom}
                                onChange={this.updateType.bind(this, 'premade')}
                            />
                            <FormattedMessage
                                id='user.settings.display.theme.themeColors'
                                defaultMessage='Theme Colors'
                            />
                        </label>
                        <br/>
                    </div>,
                );
            }

            inputs.push(premade);

            if (this.props.allowCustomThemes) {
                inputs.push(
                    <div
                        className='radio'
                        key='customThemeColorLabel'
                    >
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
                    </div>,
                );

                inputs.push(custom);

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

                inputs.push(
                    <div
                        key='importSlackThemeButton'
                        className='pt-2'
                    >
                        <button
                            id='slackImportTheme'
                            className='theme style--none color--link'
                            onClick={this.handleImportModal}
                        >
                            <FormattedMessage
                                id='user.settings.display.theme.import'
                                defaultMessage='Import theme colors from Slack'
                            />
                        </button>
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
                    inputs={inputs}
                    submitExtra={allTeamsCheckbox}
                    submit={this.submitTheme}
                    disableEnterSubmit={true}
                    saving={this.state.isSaving}
                    serverError={serverError}
                    width='full'
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
