// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {savePreferences} from '../../utils/client.jsx';
import SettingItemMin from '../setting_item_min.jsx';
import SettingItemMax from '../setting_item_max.jsx';
import Constants from '../../utils/constants.jsx';
import PreferenceStore from '../../stores/preference_store.jsx';
import * as Utils from '../../utils/utils.jsx';

function getDisplayStateFromStores() {
    const militaryTime = PreferenceStore.getPreference(Constants.Preferences.CATEGORY_DISPLAY_SETTINGS, 'use_military_time', {value: 'false'});
    const nameFormat = PreferenceStore.getPreference(Constants.Preferences.CATEGORY_DISPLAY_SETTINGS, 'name_format', {value: 'username'});
    const emojiStyle = PreferenceStore.getPreference(Constants.Preferences.CATEGORY_DISPLAY_SETTINGS, 'emoji_style', {value: 'default'});

    return {
        militaryTime: militaryTime.value,
        nameFormat: nameFormat.value,
        emojiStyle: emojiStyle.value
    };
}

export default class UserSettingsDisplay extends React.Component {
    constructor(props) {
        super(props);

        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleClockRadio = this.handleClockRadio.bind(this);
        this.handleNameRadio = this.handleNameRadio.bind(this);
        this.updateSection = this.updateSection.bind(this);

        this.state = getDisplayStateFromStores();
    }
    handleSubmit() {
        const timePreference = PreferenceStore.setPreference(Constants.Preferences.CATEGORY_DISPLAY_SETTINGS, 'use_military_time', this.state.militaryTime);
        const namePreference = PreferenceStore.setPreference(Constants.Preferences.CATEGORY_DISPLAY_SETTINGS, 'name_format', this.state.nameFormat);
        const emojiStyle = PreferenceStore.setPreference(Constants.Preferences.CATEGORY_DISPLAY_SETTINGS, 'emoji_style', this.state.emojiStyle);

        savePreferences([timePreference, namePreference, emojiStyle],
            () => {
                PreferenceStore.emitChange();
                this.updateSection('');
            },
            (err) => {
                this.setState({serverError: err.message});
            }
        );
    }
    handleClockRadio(militaryTime) {
        this.setState({militaryTime});
    }
    handleNameRadio(nameFormat) {
        this.setState({nameFormat});
    }
    handleEmojiRadio(emojiStyle) {
        this.setState({emojiStyle});
    }
    updateSection(section) {
        this.setState(getDisplayStateFromStores());
        this.props.updateSection(section);
    }
    render() {
        const serverError = this.state.serverError || null;
        let clockSection;
        let nameFormatSection;
        let emojiSection;
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
                                type='radio'
                                checked={clockFormat[0]}
                                onChange={this.handleClockRadio.bind(this, 'false')}
                            />
                            {'12-hour clock (example: 4:00 PM)'}
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                checked={clockFormat[1]}
                                onChange={this.handleClockRadio.bind(this, 'true')}
                            />
                            {'24-hour clock (example: 16:00)'}
                        </label>
                        <br/>
                    </div>
                    <div><br/>{'Select how you prefer time displayed.'}</div>
                </div>
            ];

            clockSection = (
                <SettingItemMax
                    title='Clock Display'
                    inputs={inputs}
                    submit={this.handleSubmit}
                    server_error={serverError}
                    updateSection={handleUpdateClockSection}
                />
            );
        } else {
            let describe = '';
            if (this.state.militaryTime === 'true') {
                describe = '24-hour clock (example: 16:00)';
            } else {
                describe = '12-hour clock (example: 4:00 PM)';
            }

            const handleUpdateClockSection = () => {
                this.props.updateSection('clock');
            };

            clockSection = (
                <SettingItemMin
                    title='Clock Display'
                    describe={describe}
                    updateSection={handleUpdateClockSection}
                />
            );
        }

        if (this.props.activeSection === 'name_format') {
            const nameFormat = [false, false, false];
            if (this.state.nameFormat === 'nickname_full_name') {
                nameFormat[0] = true;
            } else if (this.state.nameFormat === 'full_name') {
                nameFormat[2] = true;
            } else {
                nameFormat[1] = true;
            }

            const inputs = [
                <div key='userDisplayNameOptions'>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                checked={nameFormat[0]}
                                onChange={this.handleNameRadio.bind(this, 'nickname_full_name')}
                            />
                            {'Show nickname if one exists, otherwise show first and last name (team default)'}
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                checked={nameFormat[1]}
                                onChange={this.handleNameRadio.bind(this, 'username')}
                            />
                            {'Show username'}
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                checked={nameFormat[2]}
                                onChange={this.handleNameRadio.bind(this, 'full_name')}
                            />
                            {'Show first and last name'}
                        </label>
                        <br/>
                    </div>
                    <div><br/>{'Set what name to display in the Direct Messages list.'}</div>
                </div>
            ];

            nameFormatSection = (
                <SettingItemMax
                    title='Teammate Name Display'
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
            let describe = '';
            if (this.state.nameFormat === 'username') {
                describe = 'Show username';
            } else if (this.state.nameFormat === 'full_name') {
                describe = 'Show first and last name';
            } else {
                describe = 'Show nickname if one exists, otherwise show first and last name (team default)';
            }

            nameFormatSection = (
                <SettingItemMin
                    title='Teammate Name Display'
                    describe={describe}
                    updateSection={() => {
                        this.props.updateSection('name_format');
                    }}
                />
            );
        }

        if (this.props.activeSection === 'emoji') {
            const inputs = [
                <div key='userDisplayClockOptions'>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                checked={this.state.emojiStyle === 'default'}
                                onChange={this.handleEmojiRadio.bind(this, 'default')}
                            />
                            {'Default Style'}
                            <img
                                className='emoji'
                                src={Utils.getImagePathForEmoticon('smile', 'default')}
                            />
                        </label>
                        <br/>
                    </div>
                    <div className='radio'>
                        <label>
                            <input
                                type='radio'
                                checked={this.state.emojiStyle === 'emojione'}
                                onChange={this.handleEmojiRadio.bind(this, 'emojione')}
                            />
                            {'Emoji One Style'}
                            <img
                                className='emoji'
                                src={Utils.getImagePathForEmoticon('smile', 'emojione')}
                            />
                            <span className='emojiAffiliation'>
                                {'Emoji provided free by '}
                                <a
                                    href='http://emojione.com/'
                                    target='blank'
                                >
                                    {'Emoji One'}
                                </a>
                            </span>
                        </label>
                        <br/>
                    </div>
                    <div><br/>{'Select how you prefer time displayed.'}</div>
                </div>
            ];

            emojiSection = (
                <SettingItemMax
                    title='Emoji Style'
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
            const describe = this.state.emojiStyle === 'default' ? 'Default Style' : 'Emoji One Style';
            emojiSection = (
                <SettingItemMin
                    title='Emoji Style'
                    describe={describe}
                    updateSection={() => {
                        this.props.updateSection('emoji');
                    }}
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
                        onClick={this.props.closeModal}
                    >
                        <span aria-hidden='true'>{'×'}</span>
                    </button>
                    <h4
                        className='modal-title'
                        ref='title'
                    >
                        <i
                            className='modal-back'
                            onClick={this.props.collapseModal}
                        />
                        {'Display Settings'}
                    </h4>
                </div>
                <div className='user-settings'>
                    <h3 className='tab-header'>{'Display Settings'}</h3>
                    <div className='divider-dark first'/>
                    {clockSection}
                    <div className='divider-dark'/>
                    {nameFormatSection}
                    <div className='divider-dark'/>
                    {emojiSection}
                    <div className='divider-dark'/>
                </div>
            </div>
        );
    }
}

UserSettingsDisplay.propTypes = {
    user: React.PropTypes.object,
    updateSection: React.PropTypes.func,
    updateTab: React.PropTypes.func,
    activeSection: React.PropTypes.string,
    closeModal: React.PropTypes.func.isRequired,
    collapseModal: React.PropTypes.func.isRequired
};
