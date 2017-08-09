// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import SettingItemMin from '../setting_item_min.jsx';
import SettingItemMax from '../setting_item_max.jsx';
import ManageLanguages from './manage_languages.jsx';
import ThemeSetting from './user_settings_theme.jsx';

import PreferenceStore from 'stores/preference_store.jsx';
import UserStore from 'stores/user_store.jsx';
import * as Utils from 'utils/utils.jsx';
import * as I18n from 'i18n/i18n.jsx';
import {savePreferences} from 'actions/user_actions.jsx';

import Constants from 'utils/constants.jsx';
const Preferences = Constants.Preferences;

import {FormattedMessage} from 'react-intl';

function getDisplayStateFromStores() {
    return {
        militaryTime: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, 'use_military_time', 'false'),
        channelDisplayMode: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.CHANNEL_DISPLAY_MODE, Preferences.CHANNEL_DISPLAY_MODE_DEFAULT),
        messageDisplay: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.MESSAGE_DISPLAY, Preferences.MESSAGE_DISPLAY_DEFAULT),
        collapseDisplay: PreferenceStore.get(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.COLLAPSE_DISPLAY, Preferences.COLLAPSE_DISPLAY_DEFAULT)
    };
}

import React from 'react';
import PropTypes from 'prop-types';

export default class UserSettingsDisplay extends React.Component {
    constructor(props) {
        super(props);

        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleClockRadio = this.handleClockRadio.bind(this);
        this.updateSection = this.updateSection.bind(this);
        this.updateState = this.updateState.bind(this);
        this.createCollapseSection = this.createCollapseSection.bind(this);

        this.state = getDisplayStateFromStores();
    }

    handleSubmit() {
        const userId = UserStore.getCurrentId();

        const timePreference = {
            user_id: userId,
            category: Preferences.CATEGORY_DISPLAY_SETTINGS,
            name: 'use_military_time',
            value: this.state.militaryTime
        };

        const channelDisplayModePreference = {
            user_id: userId,
            category: Preferences.CATEGORY_DISPLAY_SETTINGS,
            name: Preferences.CHANNEL_DISPLAY_MODE,
            value: this.state.channelDisplayMode
        };
        const messageDisplayPreference = {
            user_id: userId,
            category: Preferences.CATEGORY_DISPLAY_SETTINGS,
            name: Preferences.MESSAGE_DISPLAY,
            value: this.state.messageDisplay
        };
        const collapseDisplayPreference = {
            user_id: userId,
            category: Preferences.CATEGORY_DISPLAY_SETTINGS,
            name: Preferences.COLLAPSE_DISPLAY,
            value: this.state.collapseDisplay
        };

        savePreferences([timePreference, channelDisplayModePreference, messageDisplayPreference, collapseDisplayPreference],
            () => {
                this.updateSection('');
            }
        );
    }

    handleClockRadio(militaryTime) {
        this.setState({militaryTime});
    }

    handleChannelDisplayModeRadio(channelDisplayMode) {
        this.setState({channelDisplayMode});
    }

    handlemessageDisplayRadio(messageDisplay) {
        this.setState({messageDisplay});
    }

    handleCollapseRadio(collapseDisplay) {
        this.setState({collapseDisplay});
    }

    updateSection(section) {
        if ($('.section-max').length) {
            $('.settings-modal .modal-body').scrollTop(0).perfectScrollbar('update');
        }
        this.updateState();
        this.props.updateSection(section);
    }

    updateState() {
        const newState = getDisplayStateFromStores();
        if (!Utils.areObjectsEqual(newState, this.state)) {
            this.setState(newState);
        }
    }

    createCollapseSection() {
        if (this.props.activeSection === 'collapse') {
            const collapseFormat = [false, false];
            if (this.state.collapseDisplay === 'false') {
                collapseFormat[0] = true;
            } else {
                collapseFormat[1] = true;
            }

            const handleUpdateCollapseSection = (e) => {
                this.updateSection('');
                e.preventDefault();
            };

            const inputs = [
                <div key='userDisplayCollapseOptions'>
                    <div className='radio'>
                        <label>
                            <input
                                id='collapseFormat'
                                type='radio'
                                name='collapseFormat'
                                checked={collapseFormat[0]}
                                onChange={this.handleCollapseRadio.bind(this, 'false')}
                            />
                            <FormattedMessage
                                id='user.settings.display.collapseOn'
                                defaultMessage='On'
                            />
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                id='collapseFormatOff'
                                type='radio'
                                name='collapseFormat'
                                checked={collapseFormat[1]}
                                onChange={this.handleCollapseRadio.bind(this, 'true')}
                            />
                            <FormattedMessage
                                id='user.settings.display.collapseOff'
                                defaultMessage='Off'
                            />
                        </label>
                        <br/>
                    </div>
                    <div>
                        <br/>
                        <FormattedMessage
                            id='user.settings.display.collapseDesc'
                            defaultMessage='Set whether previews of image links show as expanded or collapsed by default. This setting can also be controlled using the slash commands /expand and /collapse.'
                        />
                    </div>
                </div>
            ];

            return (
                <SettingItemMax
                    title={
                        <FormattedMessage
                            id='user.settings.display.collapseDisplay'
                            defaultMessage='Default appearance of image link previews'
                        />
                    }
                    inputs={inputs}
                    submit={this.handleSubmit}
                    server_error={this.state.serverError}
                    updateSection={handleUpdateCollapseSection}
                />
            );
        }

        let describe;
        if (this.state.collapseDisplay === 'false') {
            describe = (
                <FormattedMessage
                    id='user.settings.display.collapseOn'
                    defaultMessage='Expanded'
                />
            );
        } else {
            describe = (
                <FormattedMessage
                    id='user.settings.display.collapseOff'
                    defaultMessage='Collapsed'
                />
            );
        }

        const handleUpdateCollapseSection = () => {
            this.props.updateSection('collapse');
        };

        return (
            <SettingItemMin
                title={
                    <FormattedMessage
                        id='user.settings.display.collapseDisplay'
                        defaultMessage='Default appearance of image link previews'
                    />
                }
                describe={describe}
                updateSection={handleUpdateCollapseSection}
            />
        );
    }

    render() {
        const serverError = this.state.serverError || null;
        let clockSection;
        let channelDisplayModeSection;
        let languagesSection;
        let messageDisplaySection;

        const collapseSection = this.createCollapseSection();

        if (this.props.activeSection === 'clock') {
            const clockFormat = [false, false];
            if (this.state.militaryTime === 'true') {
                clockFormat[1] = true;
            } else {
                clockFormat[0] = true;
            }

            const handleUpdateClockSection = (e) => {
                this.updateSection('');
                e.preventDefault();
            };

            const inputs = [
                <div key='userDisplayClockOptions'>
                    <div className='radio'>
                        <label>
                            <input
                                id='clockFormat12h'
                                type='radio'
                                name='clockFormat'
                                checked={clockFormat[0]}
                                onChange={this.handleClockRadio.bind(this, 'false')}
                            />
                            <FormattedMessage
                                id='user.settings.display.normalClock'
                                defaultMessage='12-hour clock (example: 4:00 PM)'
                            />
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                id='clockFormat24h'
                                type='radio'
                                name='clockFormat'
                                checked={clockFormat[1]}
                                onChange={this.handleClockRadio.bind(this, 'true')}
                            />
                            <FormattedMessage
                                id='user.settings.display.militaryClock'
                                defaultMessage='24-hour clock (example: 16:00)'
                            />
                        </label>
                        <br/>
                    </div>
                    <div>
                        <br/>
                        <FormattedMessage
                            id='user.settings.display.preferTime'
                            defaultMessage='Select how you prefer time displayed.'
                        />
                    </div>
                </div>
            ];

            clockSection = (
                <SettingItemMax
                    title={
                        <FormattedMessage
                            id='user.settings.display.clockDisplay'
                            defaultMessage='Clock Display'
                        />
                    }
                    inputs={inputs}
                    submit={this.handleSubmit}
                    server_error={serverError}
                    updateSection={handleUpdateClockSection}
                />
            );
        } else {
            let describe;
            if (this.state.militaryTime === 'true') {
                describe = (
                    <FormattedMessage
                        id='user.settings.display.militaryClock'
                        defaultMessage='24-hour clock (example: 16:00)'
                    />
                );
            } else {
                describe = (
                    <FormattedMessage
                        id='user.settings.display.normalClock'
                        defaultMessage='12-hour clock (example: 4:00 PM)'
                    />
                );
            }

            const handleUpdateClockSection = () => {
                this.props.updateSection('clock');
            };

            clockSection = (
                <SettingItemMin
                    title={
                        <FormattedMessage
                            id='user.settings.display.clockDisplay'
                            defaultMessage='Clock Display'
                        />
                    }
                    describe={describe}
                    updateSection={handleUpdateClockSection}
                />
            );
        }

        if (this.props.activeSection === Preferences.MESSAGE_DISPLAY) {
            const messageDisplay = [false, false];
            if (this.state.messageDisplay === Preferences.MESSAGE_DISPLAY_CLEAN) {
                messageDisplay[0] = true;
            } else {
                messageDisplay[1] = true;
            }

            const inputs = [
                <div key='userDisplayNameOptions'>
                    <div className='radio'>
                        <label>
                            <input
                                id='messageFormatStandard'
                                type='radio'
                                name='messageDisplay'
                                checked={messageDisplay[0]}
                                onChange={this.handlemessageDisplayRadio.bind(this, Preferences.MESSAGE_DISPLAY_CLEAN)}
                            />
                            <FormattedMessage
                                id='user.settings.display.messageDisplayClean'
                                defaultMessage='Standard'
                            />
                            {': '}
                            <span className='font-weight--normal'>
                                <FormattedMessage
                                    id='user.settings.display.messageDisplayCleanDes'
                                    defaultMessage='Easy to scan and read.'
                                />
                            </span>
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                id='messageFormatCompact'
                                type='radio'
                                name='messageDisplay'
                                checked={messageDisplay[1]}
                                onChange={this.handlemessageDisplayRadio.bind(this, Preferences.MESSAGE_DISPLAY_COMPACT)}
                            />
                            <FormattedMessage
                                id='user.settings.display.messageDisplayCompact'
                                defaultMessage='Compact'
                            />
                            {': '}
                            <span className='font-weight--normal'>
                                <FormattedMessage
                                    id='user.settings.display.messageDisplayCompactDes'
                                    defaultMessage='Fit as many messages on the screen as we can.'
                                />
                            </span>
                        </label>
                        <br/>
                    </div>
                    <div>
                        <br/>
                        <FormattedMessage
                            id='user.settings.display.messageDisplayDescription'
                            defaultMessage='Select how messages in a channel should be displayed.'
                        />
                    </div>
                </div>
            ];

            messageDisplaySection = (
                <SettingItemMax
                    title={
                        <FormattedMessage
                            id='user.settings.display.messageDisplayTitle'
                            defaultMessage='Message Display'
                        />
                    }
                    inputs={inputs}
                    submit={this.handleSubmit}
                    server_error={serverError}
                    updateSection={(e) => {
                        this.updateSection('');
                        e.preventDefault();
                    }}
                />
            );
        } else {
            let describe;
            if (this.state.messageDisplay === Preferences.MESSAGE_DISPLAY_CLEAN) {
                describe = (
                    <FormattedMessage
                        id='user.settings.display.messageDisplayClean'
                        defaultMessage='Standard'
                    />
                );
            } else {
                describe = (
                    <FormattedMessage
                        id='user.settings.display.messageDisplayCompact'
                        defaultMessage='Compact'
                    />
                );
            }

            messageDisplaySection = (
                <SettingItemMin
                    title={
                        <FormattedMessage
                            id='user.settings.display.messageDisplayTitle'
                            defaultMessage='Message Display'
                        />
                    }
                    describe={describe}
                    updateSection={() => {
                        this.props.updateSection(Preferences.MESSAGE_DISPLAY);
                    }}
                />
            );
        }

        if (this.props.activeSection === Preferences.CHANNEL_DISPLAY_MODE) {
            const channelDisplayMode = [false, false];
            if (this.state.channelDisplayMode === Preferences.CHANNEL_DISPLAY_MODE_FULL_SCREEN) {
                channelDisplayMode[0] = true;
            } else {
                channelDisplayMode[1] = true;
            }

            const inputs = [
                <div key='userDisplayNameOptions'>
                    <div className='radio'>
                        <label>
                            <input
                                id='channelDisplayFormatFullScreen'
                                type='radio'
                                name='channelDisplayMode'
                                checked={channelDisplayMode[0]}
                                onChange={this.handleChannelDisplayModeRadio.bind(this, Preferences.CHANNEL_DISPLAY_MODE_FULL_SCREEN)}
                            />
                            <FormattedMessage
                                id='user.settings.display.fullScreen'
                                defaultMessage='Full width'
                            />
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                id='channelDisplayFormatCentered'
                                type='radio'
                                name='channelDisplayMode'
                                checked={channelDisplayMode[1]}
                                onChange={this.handleChannelDisplayModeRadio.bind(this, Preferences.CHANNEL_DISPLAY_MODE_CENTERED)}
                            />
                            <FormattedMessage
                                id='user.settings.display.fixedWidthCentered'
                                defaultMessage='Fixed width, centered'
                            />
                        </label>
                        <br/>
                    </div>
                    <div>
                        <br/>
                        <FormattedMessage
                            id='user.settings.display.channeldisplaymode'
                            defaultMessage='Select the width of the center channel.'
                        />
                    </div>
                </div>
            ];

            channelDisplayModeSection = (
                <SettingItemMax
                    title={
                        <FormattedMessage
                            id='user.settings.display.channelDisplayTitle'
                            defaultMessage='Channel Display Mode'
                        />
                    }
                    inputs={inputs}
                    submit={this.handleSubmit}
                    server_error={serverError}
                    updateSection={(e) => {
                        this.updateSection('');
                        e.preventDefault();
                    }}
                />
            );
        } else {
            let describe;
            if (this.state.channelDisplayMode === Preferences.CHANNEL_DISPLAY_MODE_FULL_SCREEN) {
                describe = (
                    <FormattedMessage
                        id='user.settings.display.fullScreen'
                        defaultMessage='Full width'
                    />
                );
            } else {
                describe = (
                    <FormattedMessage
                        id='user.settings.display.fixedWidthCentered'
                        defaultMessage='Fixed width, centered'
                    />
                );
            }

            channelDisplayModeSection = (
                <SettingItemMin
                    title={
                        <FormattedMessage
                            id='user.settings.display.channelDisplayTitle'
                            defaultMessage='Channel Display Mode'
                        />
                    }
                    describe={describe}
                    updateSection={() => {
                        this.props.updateSection(Preferences.CHANNEL_DISPLAY_MODE);
                    }}
                />
            );
        }

        let userLocale = this.props.user.locale;
        if (this.props.activeSection === 'languages') {
            if (!I18n.isLanguageAvailable(userLocale)) {
                userLocale = global.window.mm_config.DefaultClientLocale;
            }
            languagesSection = (
                <ManageLanguages
                    user={this.props.user}
                    locale={userLocale}
                    updateSection={(e) => {
                        this.updateSection('');
                        e.preventDefault();
                    }}
                />
            );
        } else {
            let locale;
            if (I18n.isLanguageAvailable(userLocale)) {
                locale = I18n.getLanguageInfo(userLocale).name;
            } else {
                locale = I18n.getLanguageInfo(global.window.mm_config.DefaultClientLocale).name;
            }

            languagesSection = (
                <SettingItemMin
                    title={
                        <FormattedMessage
                            id='user.settings.display.language'
                            defaultMessage='Language'
                        />
                    }
                    width='medium'
                    describe={locale}
                    updateSection={() => {
                        this.updateSection('languages');
                    }}
                />
            );
        }

        return (
            <div>
                <div className='modal-header'>
                    <button
                        id='closeButton'
                        type='button'
                        className='close'
                        data-dismiss='modal'
                        aria-label='Close'
                        onClick={this.props.closeModal}
                    >
                        <span aria-hidden='true'>{'×'}</span>
                    </button>
                    <h4
                        className='modal-title'
                        ref='title'
                    >
                        <div className='modal-back'>
                            <i
                                className='fa fa-angle-left'
                                onClick={this.props.collapseModal}
                            />
                        </div>
                        <FormattedMessage
                            id='user.settings.display.title'
                            defaultMessage='Display Settings'
                        />
                    </h4>
                </div>
                <div className='user-settings'>
                    <h3 className='tab-header'>
                        <FormattedMessage
                            id='user.settings.display.title'
                            defaultMessage='Display Settings'
                        />
                    </h3>
                    <div className='divider-dark first'/>
                    <ThemeSetting
                        selected={this.props.activeSection === 'theme'}
                        updateSection={this.updateSection}
                        setRequireConfirm={this.props.setRequireConfirm}
                        setEnforceFocus={this.props.setEnforceFocus}
                    />
                    <div className='divider-dark'/>
                    {clockSection}
                    <div className='divider-dark'/>
                    {collapseSection}
                    <div className='divider-dark'/>
                    {messageDisplaySection}
                    <div className='divider-dark'/>
                    {channelDisplayModeSection}
                    <div className='divider-dark'/>
                    {languagesSection}
                </div>
            </div>
        );
    }
}

UserSettingsDisplay.propTypes = {
    user: PropTypes.object,
    updateSection: PropTypes.func,
    updateTab: PropTypes.func,
    activeSection: PropTypes.string,
    closeModal: PropTypes.func.isRequired,
    collapseModal: PropTypes.func.isRequired,
    setRequireConfirm: PropTypes.func.isRequired,
    setEnforceFocus: PropTypes.func.isRequired
};
