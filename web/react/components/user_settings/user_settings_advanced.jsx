// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Client from '../../utils/client.jsx';
import SettingItemMin from '../setting_item_min.jsx';
import SettingItemMax from '../setting_item_max.jsx';
import Constants from '../../utils/constants.jsx';
import PreferenceStore from '../../stores/preference_store.jsx';

import {intlShape, injectIntl, defineMessages, FormattedMessage} from 'mm-intl';

const PreReleaseFeatures = Constants.PRE_RELEASE_FEATURES;

const holders = defineMessages({
    sendTitle: {
        id: 'user.settings.advance.sendTitle',
        defaultMessage: 'Send messages on Ctrl + Enter'
    },
    on: {
        id: 'user.settings.advance.on',
        defaultMessage: 'On'
    },
    off: {
        id: 'user.settings.advance.off',
        defaultMessage: 'Off'
    },
    preReleaseTitle: {
        id: 'user.settings.advance.preReleaseTitle',
        defaultMessage: 'Preview pre-release features'
    },
    feature: {
        id: 'user.settings.advance.feature',
        defaultMessage: ' Feature '
    },
    features: {
        id: 'user.settings.advance.features',
        defaultMessage: ' Features '
    },
    enabled: {
        id: 'user.settings.advance.enabled',
        defaultMessage: 'enabled'
    },
    MARKDOWN_PREVIEW: {
        id: 'user.settings.advance.markdown_preview',
        defaultMessage: 'Show markdown preview option in message input box'
    },
    EMBED_PREVIEW: {
        id: 'user.settings.advance.embed_preview',
        defaultMessage: 'Show preview snippet of links below message'
    },
    EMBED_TOGGLE: {
        id: 'user.settings.advance.embed_toggle',
        defaultMessage: 'Show toggle for all embed previews'
    }
});

class AdvancedSettingsDisplay extends React.Component {
    constructor(props) {
        super(props);

        this.updateSection = this.updateSection.bind(this);
        this.updateSetting = this.updateSetting.bind(this);
        this.toggleFeature = this.toggleFeature.bind(this);
        this.saveEnabledFeatures = this.saveEnabledFeatures.bind(this);

        const preReleaseFeaturesKeys = Object.keys(PreReleaseFeatures);
        const advancedSettings = PreferenceStore.getCategory(Constants.Preferences.CATEGORY_ADVANCED_SETTINGS);
        const settings = {
            send_on_ctrl_enter: PreferenceStore.getPreference(
                Constants.Preferences.CATEGORY_ADVANCED_SETTINGS,
                'send_on_ctrl_enter',
                {value: 'false'}
            ).value
        };

        let enabledFeatures = 0;
        advancedSettings.forEach((setting) => {
            preReleaseFeaturesKeys.forEach((key) => {
                const feature = PreReleaseFeatures[key];
                if (setting.name === Constants.FeatureTogglePrefix + feature.label) {
                    settings[setting.name] = setting.value;
                    if (setting.value === 'true') {
                        enabledFeatures++;
                    }
                }
            });
        });

        this.state = {preReleaseFeatures: PreReleaseFeatures, settings, preReleaseFeaturesKeys, enabledFeatures};
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

        (Array.isArray(settings) ? settings : [settings]).forEach((setting) => {
            preferences.push(
                PreferenceStore.setPreference(
                    Constants.Preferences.CATEGORY_ADVANCED_SETTINGS,
                    setting,
                    String(this.state.settings[setting])
                )
            );
        });

        Client.savePreferences(preferences,
            () => {
                PreferenceStore.emitChange();
                this.updateSection('');
            },
            (err) => {
                this.setState({serverError: err.message});
            }
        );
    }

    updateSection(section) {
        this.props.updateSection(section);
    }

    render() {
        const serverError = this.state.serverError || null;
        const {formatMessage} = this.props.intl;
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
                                type='radio'
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
                                type='radio'
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
                            defaultMessage="If enabled 'Enter' inserts a new line and 'Ctrl + Enter' submits the message."
                        />
                    </div>
                </div>
            ];

            ctrlSendSection = (
                <SettingItemMax
                    title={formatMessage(holders.sendTitle)}
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
                    title={formatMessage(holders.sendTitle)}
                    describe={this.state.settings.send_on_ctrl_enter === 'true' ? formatMessage(holders.on) : formatMessage(holders.off)}
                    updateSection={() => this.props.updateSection('advancedCtrlSend')}
                />
            );
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
                                        type='checkbox'
                                        checked={this.state.settings[Constants.FeatureTogglePrefix + feature.label] === 'true'}
                                        onChange={(e) => {
                                            this.toggleFeature(feature.label, e.target.checked);
                                        }}
                                    />
                                    {formatMessage(holders[key])}
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
                        title={formatMessage(holders.preReleaseTitle)}
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
                        title={formatMessage(holders.preReleaseTitle)}
                        describe={this.state.enabledFeatures + (this.state.enabledFeatures === 1 ? formatMessage(holders.feature) : formatMessage(holders.features)) + formatMessage(holders.enabled)}
                        updateSection={() => this.props.updateSection('advancedPreviewFeatures')}
                    />
                );
            }
        }

        return (
            <div>
                <div className='modal-header'>
                    <button
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
                    {previewFeaturesSectionDivider}
                    {previewFeaturesSection}
                    <div className='divider-dark'/>
                </div>
            </div>
        );
    }
}

AdvancedSettingsDisplay.propTypes = {
    intl: intlShape.isRequired,
    user: React.PropTypes.object,
    updateSection: React.PropTypes.func,
    updateTab: React.PropTypes.func,
    activeSection: React.PropTypes.string,
    closeModal: React.PropTypes.func.isRequired,
    collapseModal: React.PropTypes.func.isRequired
};

export default injectIntl(AdvancedSettingsDisplay);
