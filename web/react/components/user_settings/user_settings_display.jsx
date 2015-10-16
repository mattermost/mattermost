// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {savePreferences} from '../../utils/client.jsx';
import SettingItemMin from '../setting_item_min.jsx';
import SettingItemMax from '../setting_item_max.jsx';
import Constants from '../../utils/constants.jsx';
import PreferenceStore from '../../stores/preference_store.jsx';

function getDisplayStateFromStores() {
    const militaryTime = PreferenceStore.getPreference(Constants.Preferences.CATEGORY_DISPLAY_SETTINGS, 'use_military_time', {value: 'false'});

    return {militaryTime: militaryTime.value};
}

export default class UserSettingsDisplay extends React.Component {
    constructor(props) {
        super(props);

        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleClockRadio = this.handleClockRadio.bind(this);
        this.updateSection = this.updateSection.bind(this);
        this.handleClose = this.handleClose.bind(this);

        this.state = getDisplayStateFromStores();
    }
    handleSubmit() {
        const preference = PreferenceStore.setPreference(Constants.Preferences.CATEGORY_DISPLAY_SETTINGS, 'use_military_time', this.state.militaryTime);

        savePreferences([preference],
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
    updateSection(section) {
        this.setState(getDisplayStateFromStores());
        this.props.updateSection(section);
    }
    handleClose() {
        this.updateSection('');
    }
    componentDidMount() {
        $('#user_settings').on('hidden.bs.modal', this.handleClose);
    }
    componentWillUnmount() {
        $('#user_settings').off('hidden.bs.modal', this.handleClose);
    }
    render() {
        const serverError = this.state.serverError || null;
        let clockSection;
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
