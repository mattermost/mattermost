// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

const Client = require('../../utils/client.jsx');
const SettingItemMin = require('../setting_item_min.jsx');
const SettingItemMax = require('../setting_item_max.jsx');
const Constants = require('../../utils/constants.jsx');
const PreferenceStore = require('../../stores/preference_store.jsx');

export default class AdvancedSettingsDisplay extends React.Component {
    constructor(props) {
        super(props);

        this.updateSection = this.updateSection.bind(this);
        this.updateSetting = this.updateSetting.bind(this);
        this.setupInitialState = this.setupInitialState.bind(this);

        this.state = this.setupInitialState();
    }

    setupInitialState() {
        const sendOnCtrlEnter = PreferenceStore.getPreference(
            Constants.Preferences.CATEGORY_ADVANCED_SETTINGS,
            'send_on_ctrl_enter',
            {value: 'false'}
        ).value;

        return {
            settings: {send_on_ctrl_enter: sendOnCtrlEnter}
        };
    }

    updateSetting(setting, value) {
        const settings = this.state.settings;
        settings[setting] = value;
        this.setState(settings);
    }

    handleSubmit(setting) {
        const preference = PreferenceStore.setPreference(
            Constants.Preferences.CATEGORY_ADVANCED_SETTINGS,
            setting,
            this.state.settings[setting]
        );

        Client.savePreferences([preference],
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
                            {'On'}
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
                            {'Off'}
                        </label>
                        <br/>
                    </div>
                    <div><br/>{'If enabled \'Enter\' inserts a new line and \'Ctrl + Enter\' submits the message.'}</div>
                </div>
            ];

            ctrlSendSection = (
                <SettingItemMax
                    title='Send messages on Ctrl + Enter'
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
                    title='Send messages on Ctrl + Enter'
                    describe={this.state.settings.send_on_ctrl_enter === 'true' ? 'On' : 'Off'}
                    updateSection={() => this.props.updateSection('advancedCtrlSend')}
                />
            );
        }

        return (
            <div>
                <div className='modal-header'>
                    <button
                        type='button'
                        className='close'
                        data-dismiss='modal'
                        aria-label='Close'
                    >
                        <span aria-hidden='true'>{'×'}</span>
                    </button>
                    <h4
                        className='modal-title'
                        ref='title'
                    >
                        <i className='modal-back'></i>
                        {'Advanced Settings'}
                    </h4>
                </div>
                <div className='user-settings'>
                    <h3 className='tab-header'>{'Advanced Settings'}</h3>
                    <div className='divider-dark first'/>
                    {ctrlSendSection}
                    <div className='divider-dark'/>
                </div>
            </div>
        );
    }
}

AdvancedSettingsDisplay.propTypes = {
    user: React.PropTypes.object,
    updateSection: React.PropTypes.func,
    updateTab: React.PropTypes.func,
    activeSection: React.PropTypes.string
};
