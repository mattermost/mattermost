// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {savePreferences} from '../../utils/client.jsx';
import SettingItemMin from '../setting_item_min.jsx';
import SettingItemMax from '../setting_item_max.jsx';
import Constants from '../../utils/constants.jsx';
import PreferenceStore from '../../stores/preference_store.jsx';

function getDisplayStateFromStores() {
    const militaryTime = PreferenceStore.getPreference(Constants.Preferences.CATEGORY_DISPLAY_SETTINGS, 'use_military_time', {value: 'false'});
    const nameFormat = PreferenceStore.getPreference(Constants.Preferences.CATEGORY_DISPLAY_SETTINGS, 'name_format', {value: 'username'});

    return {
        militaryTime: militaryTime.value,
        nameFormat: nameFormat.value
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

        savePreferences([timePreference, namePreference],
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
    updateSection(section) {
        this.setState(getDisplayStateFromStores());
        this.props.updateSection(section);
    }
    render() {
        const serverError = this.state.serverError || null;
        let clockSection;
        let nameFormatSection;
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
                    <div><br/>{'How should other users be shown in Direct Messages list?'}</div>
                </div>
            ];

            nameFormatSection = (
                <SettingItemMax
                    title='Show real names, nick names or usernames?'
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
                    title='Show real names, nick names or usernames?'
                    describe={describe}
                    updateSection={() => {
                        this.props.updateSection('name_format');
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
                    >
                        <span aria-hidden='true'>{'×'}</span>
                    </button>
                    <h4
                        className='modal-title'
                        ref='title'
                    >
                        <i className='modal-back'></i>
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
                </div>
            </div>
        );
    }
}

UserSettingsDisplay.propTypes = {
    user: React.PropTypes.object,
    updateSection: React.PropTypes.func,
    updateTab: React.PropTypes.func,
    activeSection: React.PropTypes.string
};
