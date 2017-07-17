// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import SettingItemMin from '../setting_item_min.jsx';
import SettingItemMax from '../setting_item_max.jsx';

import PreferenceStore from 'stores/preference_store.jsx';
import UserStore from 'stores/user_store.jsx';

import Constants from 'utils/constants.jsx';
const PreReleaseFeatures = Constants.PRE_RELEASE_FEATURES;
import * as Utils from 'utils/utils.jsx';

import {savePreferences} from 'actions/user_actions.jsx';

import React from 'react';
import PropTypes from 'prop-types';
import {FormattedMessage} from 'react-intl';

export default class AdvancedSettingsDisplay extends React.Component {
    constructor(props) {
        super(props);

        this.getStateFromStores = this.getStateFromStores.bind(this);
        this.updateSection = this.updateSection.bind(this);
        this.updateSetting = this.updateSetting.bind(this);
        this.toggleFeature = this.toggleFeature.bind(this);
        this.saveEnabledFeatures = this.saveEnabledFeatures.bind(this);

        this.renderFormattingSection = this.renderFormattingSection.bind(this);
        this.renderJoinLeaveSection = this.renderJoinLeaveSection.bind(this);

        this.state = this.getStateFromStores();
    }

    getStateFromStores() {
        let preReleaseFeaturesKeys = Object.keys(PreReleaseFeatures);
        const advancedSettings = PreferenceStore.getCategory(Constants.Preferences.CATEGORY_ADVANCED_SETTINGS);
        const settings = {
            send_on_ctrl_enter: PreferenceStore.get(
                Constants.Preferences.CATEGORY_ADVANCED_SETTINGS,
                'send_on_ctrl_enter',
                'false'
            ),
            formatting: PreferenceStore.get(
                Constants.Preferences.CATEGORY_ADVANCED_SETTINGS,
                'formatting',
                'true'
            ),
            join_leave: PreferenceStore.get(
                Constants.Preferences.CATEGORY_ADVANCED_SETTINGS,
                'join_leave',
                'true'
            )
        };

        const webrtcEnabled = global.mm_config.EnableWebrtc === 'true';
        const linkPreviewsEnabled = global.mm_config.EnableLinkPreviews === 'true';

        if (!webrtcEnabled) {
            preReleaseFeaturesKeys = preReleaseFeaturesKeys.filter((f) => f !== 'WEBRTC_PREVIEW');
        }

        if (!linkPreviewsEnabled) {
            preReleaseFeaturesKeys = preReleaseFeaturesKeys.filter((f) => f !== 'EMBED_PREVIEW');
        }

        let enabledFeatures = 0;
        for (const [name, value] of advancedSettings) {
            for (const key of preReleaseFeaturesKeys) {
                const feature = PreReleaseFeatures[key];

                if (name === Constants.FeatureTogglePrefix + feature.label) {
                    settings[name] = value;

                    if (value === 'true') {
                        enabledFeatures += 1;
                    }
                }
            }
        }

        return {preReleaseFeatures: PreReleaseFeatures,
            settings,
            preReleaseFeaturesKeys,
            enabledFeatures
        };
    }

    updateSetting(setting, value) {
        const settings = this.state.settings;
        settings[setting] = value;
        this.setState(settings);
    }

    toggleFeature(feature, checked) {
        const settings = this.state.settings;
        settings[Constants.FeatureTogglePrefix + feature] = String(checked);

        let enabledFeatures = 0;
        Object.keys(this.state.settings).forEach((setting) => {
            if (setting.lastIndexOf(Constants.FeatureTogglePrefix) === 0 && this.state.settings[setting] === 'true') {
                enabledFeatures++;
            }
        });

        this.setState({settings, enabledFeatures});
    }

    saveEnabledFeatures() {
        const features = [];
        Object.keys(this.state.settings).forEach((setting) => {
            if (setting.lastIndexOf(Constants.FeatureTogglePrefix) === 0) {
                features.push(setting);
            }
        });

        this.handleSubmit(features);
    }

    handleSubmit(settings) {
        const preferences = [];
        const userId = UserStore.getCurrentId();

        // this should be refactored so we can actually be certain about what type everything is
        (Array.isArray(settings) ? settings : [settings]).forEach((setting) => {
            preferences.push({
                user_id: userId,
                category: Constants.Preferences.CATEGORY_ADVANCED_SETTINGS,
                name: setting,
                value: this.state.settings[setting]
            });
        });

        savePreferences(
            preferences,
            () => {
                this.updateSection('');
            }
        );
    }

    updateSection(section) {
        if ($('.section-max').length) {
            $('.settings-modal .modal-body').scrollTop(0).perfectScrollbar('update');
        }
        if (!section) {
            this.setState(this.getStateFromStores());
        }
        this.props.updateSection(section);
    }

    renderOnOffLabel(enabled) {
        if (enabled === 'false') {
            return (
                <FormattedMessage
                    id='user.settings.advance.off'
                    defaultMessage='Off'
                />
            );
        }

        return (
            <FormattedMessage
                id='user.settings.advance.on'
                defaultMessage='On'
            />
        );
    }

    renderFormattingSection() {
        if (this.props.activeSection === 'formatting') {
            return (
                <SettingItemMax
                    title={
                        <FormattedMessage
                            id='user.settings.advance.formattingTitle'
                            defaultMessage='Enable Post Formatting'
                        />
                    }
                    inputs={[
                        <div key='formattingSetting'>
                            <div className='radio'>
                                <label>
                                    <input
                                        id='postFormattingOn'
                                        type='radio'
                                        name='formatting'
                                        checked={this.state.settings.formatting !== 'false'}
                                        onChange={this.updateSetting.bind(this, 'formatting', 'true')}
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
                                        id='postFormattingOff'
                                        type='radio'
                                        name='formatting'
                                        checked={this.state.settings.formatting === 'false'}
                                        onChange={this.updateSetting.bind(this, 'formatting', 'false')}
                                    />
                                    <FormattedMessage
                                        id='user.settings.advance.off'
                                        defaultMessage='Off'
                                    />
                                </label>
                                <br/>
                            </div>
                            <div>
                                <br/>
                                <FormattedMessage
                                    id='user.settings.advance.formattingDesc'
                                    defaultMessage='If enabled, posts will be formatted to create links, show emoji, style the text, and add line breaks. By default, this setting is enabled. Changing this setting requires the page to be refreshed.'
                                />
                            </div>
                        </div>
                    ]}
                    submit={() => this.handleSubmit('formatting')}
                    server_error={this.state.serverError}
                    updateSection={(e) => {
                        this.updateSection('');
                        e.preventDefault();
                    }}
                />
            );
        }

        return (
            <SettingItemMin
                title={
                    <FormattedMessage
                        id='user.settings.advance.formattingTitle'
                        defaultMessage='Enable Post Formatting'
                    />
                }
                describe={this.renderOnOffLabel(this.state.settings.formatting)}
                updateSection={() => this.props.updateSection('formatting')}
            />
        );
    }

    renderJoinLeaveSection() {
        if (window.mm_config.BuildEnterpriseReady === 'true' && window.mm_license && window.mm_license.IsLicensed === 'true') {
            if (this.props.activeSection === 'join_leave') {
                return (
                    <SettingItemMax
                        title={
                            <FormattedMessage
                                id='user.settings.advance.joinLeaveTitle'
                                defaultMessage='Enable Join/Leave Messages'
                            />
                        }
                        inputs={[
                            <div key='joinLeaveSetting'>
                                <div className='radio'>
                                    <label>
                                        <input
                                            id='joinLeaveOn'
                                            type='radio'
                                            name='join_leave'
                                            checked={this.state.settings.join_leave !== 'false'}
                                            onChange={this.updateSetting.bind(this, 'join_leave', 'true')}
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
                                            id='joinLeaveOff'
                                            type='radio'
                                            name='join_leave'
                                            checked={this.state.settings.join_leave === 'false'}
                                            onChange={this.updateSetting.bind(this, 'join_leave', 'false')}
                                        />
                                        <FormattedMessage
                                            id='user.settings.advance.off'
                                            defaultMessage='Off'
                                        />
                                    </label>
                                    <br/>
                                </div>
                                <div>
                                    <br/>
                                    <FormattedMessage
                                        id='user.settings.advance.joinLeaveDesc'
                                        defaultMessage='When "On", System Messages saying a user has joined or left a channel will be visible. When "Off", the System Messages about joining or leaving a channel will be hidden. A message will still show up when you are added to a channel, so you can receive a notification.'
                                    />
                                </div>
                            </div>
                        ]}
                        submit={() => this.handleSubmit('join_leave')}
                        server_error={this.state.serverError}
                        updateSection={(e) => {
                            this.updateSection('');
                            e.preventDefault();
                        }}
                    />
                );
            }

            return (
                <SettingItemMin
                    title={
                        <FormattedMessage
                            id='user.settings.advance.joinLeaveTitle'
                            defaultMessage='Enable Join/Leave Messages'
                        />
                    }
                    describe={this.renderOnOffLabel(this.state.settings.join_leave)}
                    updateSection={() => this.props.updateSection('join_leave')}
                />
            );
        }

        return null;
    }

    renderFeatureLabel(feature) {
        switch (feature) {
        case 'MARKDOWN_PREVIEW':
            return (
                <FormattedMessage
                    id='user.settings.advance.markdown_preview'
                    defaultMessage='Show markdown preview option in message input box'
                />
            );
        case 'EMBED_PREVIEW':
            return (
                <FormattedMessage
                    id='user.settings.advance.embed_preview'
                    defaultMessage='For the first web link in a message, display a preview of website content below the message, if available'
                />
            );
        case 'WEBRTC_PREVIEW':
            return (
                <FormattedMessage
                    id='user.settings.advance.webrtc_preview'
                    defaultMessage='Enable the ability to make and receive one-on-one WebRTC calls'
                />
            );
        default:
            return null;
        }
    }

    render() {
        const serverError = this.state.serverError || null;
        let ctrlSendSection;

        if (this.props.activeSection === 'advancedCtrlSend') {
            const ctrlSendActive = [
                this.state.settings.send_on_ctrl_enter === 'true',
                this.state.settings.send_on_ctrl_enter === 'false'
            ];

            const inputs = [
                <div key='ctrlSendSetting'>
                    <div className='radio'>
                        <label>
                            <input
                                id='ctrlSendOn'
                                type='radio'
                                name='sendOnCtrlEnter'
                                checked={ctrlSendActive[0]}
                                onChange={this.updateSetting.bind(this, 'send_on_ctrl_enter', 'true')}
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
                                id='ctrlSendOff'
                                type='radio'
                                name='sendOnCtrlEnter'
                                checked={ctrlSendActive[1]}
                                onChange={this.updateSetting.bind(this, 'send_on_ctrl_enter', 'false')}
                            />
                            <FormattedMessage
                                id='user.settings.advance.off'
                                defaultMessage='Off'
                            />
                        </label>
                        <br/>
                    </div>
                    <div>
                        <br/>
                        <FormattedMessage
                            id='user.settings.advance.sendDesc'
                            defaultMessage='If enabled ENTER inserts a new line and CTRL+ENTER submits the message.'
                        />
                    </div>
                </div>
            ];
            ctrlSendSection = (
                <SettingItemMax
                    title={
                        <FormattedMessage
                            id='user.settings.advance.sendTitle'
                            defaultMessage='Send messages on CTRL+ENTER'
                        />
                    }
                    inputs={inputs}
                    submit={() => this.handleSubmit('send_on_ctrl_enter')}
                    server_error={serverError}
                    updateSection={(e) => {
                        this.updateSection('');
                        e.preventDefault();
                    }}
                />
            );
        } else {
            ctrlSendSection = (
                <SettingItemMin
                    title={
                        <FormattedMessage
                            id='user.settings.advance.sendTitle'
                            defaultMessage='Send messages on CTRL+ENTER'
                        />
                    }
                    describe={this.renderOnOffLabel(this.state.settings.send_on_ctrl_enter)}
                    updateSection={() => this.props.updateSection('advancedCtrlSend')}
                />
            );
        }

        const formattingSection = this.renderFormattingSection();
        let formattingSectionDivider = null;
        if (formattingSection) {
            formattingSectionDivider = <div className='divider-light'/>;
        }

        const displayJoinLeaveSection = this.renderJoinLeaveSection();
        let displayJoinLeaveSectionDivider = null;
        if (displayJoinLeaveSection) {
            displayJoinLeaveSectionDivider = <div className='divider-light'/>;
        }

        let previewFeaturesSection;
        let previewFeaturesSectionDivider;
        if (this.state.preReleaseFeaturesKeys.length > 0) {
            previewFeaturesSectionDivider = (
                <div className='divider-light'/>
            );

            if (this.props.activeSection === 'advancedPreviewFeatures') {
                const inputs = [];

                this.state.preReleaseFeaturesKeys.forEach((key) => {
                    const feature = this.state.preReleaseFeatures[key];
                    inputs.push(
                        <div key={'advancedPreviewFeatures_' + feature.label}>
                            <div className='checkbox'>
                                <label>
                                    <input
                                        id={'advancedPreviewFeatures' + feature.label}
                                        type='checkbox'
                                        checked={this.state.settings[Constants.FeatureTogglePrefix + feature.label] === 'true'}
                                        onChange={(e) => {
                                            this.toggleFeature(feature.label, e.target.checked);
                                        }}
                                    />
                                    {this.renderFeatureLabel(key)}
                                </label>
                            </div>
                        </div>
                    );
                });

                inputs.push(
                    <div key='advancedPreviewFeatures_helptext'>
                        <br/>
                        <FormattedMessage
                            id='user.settings.advance.preReleaseDesc'
                            defaultMessage="Check any pre-released features you'd like to preview.  You may also need to refresh the page before the setting will take effect."
                        />
                    </div>
                );
                previewFeaturesSection = (
                    <SettingItemMax
                        title={
                            <FormattedMessage
                                id='user.settings.advance.preReleaseTitle'
                                defaultMessage='Preview pre-release features'
                            />
                        }
                        inputs={inputs}
                        submit={this.saveEnabledFeatures}
                        server_error={serverError}
                        updateSection={(e) => {
                            this.updateSection('');
                            e.preventDefault();
                        }}
                    />
                );
            } else {
                previewFeaturesSection = (
                    <SettingItemMin
                        title={Utils.localizeMessage('user.settings.advance.preReleaseTitle', 'Preview pre-release features')}
                        describe={
                            <FormattedMessage
                                id='user.settings.advance.enabledFeatures'
                                defaultMessage='{count, number} {count, plural, one {Feature} other {Features}} Enabled'
                                values={{count: this.state.enabledFeatures}}
                            />
                        }
                        updateSection={() => this.props.updateSection('advancedPreviewFeatures')}
                    />
                );
            }
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
                            id='user.settings.advance.title'
                            defaultMessage='Advanced Settings'
                        />
                    </h4>
                </div>
                <div className='user-settings'>
                    <h3 className='tab-header'>
                        <FormattedMessage
                            id='user.settings.advance.title'
                            defaultMessage='Advanced Settings'
                        />
                    </h3>
                    <div className='divider-dark first'/>
                    {ctrlSendSection}
                    {formattingSectionDivider}
                    {formattingSection}
                    {displayJoinLeaveSectionDivider}
                    {displayJoinLeaveSection}
                    {previewFeaturesSectionDivider}
                    {previewFeaturesSection}
                    <div className='divider-dark'/>
                </div>
            </div>
        );
    }
}

AdvancedSettingsDisplay.propTypes = {
    user: PropTypes.object,
    updateSection: PropTypes.func,
    updateTab: PropTypes.func,
    activeSection: PropTypes.string,
    closeModal: PropTypes.func.isRequired,
    collapseModal: PropTypes.func.isRequired
};
