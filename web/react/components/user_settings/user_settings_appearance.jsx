// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var UserStore = require('../../stores/user_store.jsx');
var SettingItemMin = require('../setting_item_min.jsx');
var SettingItemMax = require('../setting_item_max.jsx');
var Client = require('../../utils/client.jsx');
var Utils = require('../../utils/utils.jsx');

var ThemeColors = ['#2389d7', '#008a17', '#dc4fad', '#ac193d', '#0072c6', '#d24726', '#ff8f32', '#82ba00', '#03b3b2', '#008299', '#4617b4', '#8c0095', '#004b8b', '#004b8b', '#570000', '#380000', '#585858', '#000000'];

export default class UserSettingsAppearance extends React.Component {
    constructor(props) {
        super(props);

        this.submitTheme = this.submitTheme.bind(this);
        this.updateTheme = this.updateTheme.bind(this);
        this.handleClose = this.handleClose.bind(this);

        this.state = this.getStateFromStores();
    }
    getStateFromStores() {
        var user = UserStore.getCurrentUser();
        var theme = '#2389d7';
        if (ThemeColors != null) {
            theme = ThemeColors[0];
        }
        if (user.props && user.props.theme) {
            theme = user.props.theme;
        }

        return {theme: theme.toLowerCase()};
    }
    submitTheme(e) {
        e.preventDefault();
        var user = UserStore.getCurrentUser();
        if (!user.props) {
            user.props = {};
        }
        user.props.theme = this.state.theme;

        Client.updateUser(user,
            function success() {
                this.props.updateSection('');
                window.location.reload();
            }.bind(this),
            function fail(err) {
                var state = this.getStateFromStores();
                state.serverError = err;
                this.setState(state);
            }.bind(this)
        );
    }
    updateTheme(e) {
        var hex = Utils.rgb2hex(e.target.style.backgroundColor);
        this.setState({theme: hex.toLowerCase()});
    }
    handleClose() {
        this.setState({serverError: null});
        this.props.updateTab('general');
    }
    componentDidMount() {
        if (this.props.activeSection === 'theme') {
            $(React.findDOMNode(this.refs[this.state.theme])).addClass('active-border');
        }
        $('#user_settings').on('hidden.bs.modal', this.handleClose);
    }
    componentDidUpdate() {
        if (this.props.activeSection === 'theme') {
            $('.color-btn').removeClass('active-border');
            $(React.findDOMNode(this.refs[this.state.theme])).addClass('active-border');
        }
    }
    componentWillUnmount() {
        $('#user_settings').off('hidden.bs.modal', this.handleClose);
        this.props.updateSection('');
    }
    render() {
        var serverError;
        if (this.state.serverError) {
            serverError = this.state.serverError;
        }

        var themeSection;
        var self = this;

        if (ThemeColors != null) {
            if (this.props.activeSection === 'theme') {
                var themeButtons = [];

                for (var i = 0; i < ThemeColors.length; i++) {
                    themeButtons.push(
                        <button
                            key={ThemeColors[i] + 'key' + i}
                            ref={ThemeColors[i]}
                            type='button'
                            className='btn btn-lg color-btn'
                            style={{backgroundColor: ThemeColors[i]}}
                            onClick={this.updateTheme}
                        />
                    );
                }

                var inputs = [];

                inputs.push(
                    <li
                        key='themeColorSetting'
                        className='setting-list-item'
                    >
                        <div
                            className='btn-group'
                            data-toggle='buttons-radio'
                        >
                            {themeButtons}
                        </div>
                    </li>
                );

                themeSection = (
                    <SettingItemMax
                        title='Theme Color'
                        inputs={inputs}
                        submit={this.submitTheme}
                        serverError={serverError}
                        updateSection={function updateSection(e) {
                            self.props.updateSection('');
                            e.preventDefault();
                        }}
                    />
                );
            } else {
                themeSection = (
                    <SettingItemMin
                        title='Theme Color'
                        describe={this.state.theme}
                        updateSection={function updateSection() {
                            self.props.updateSection('theme');
                        }}
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
                    >
                        <span aria-hidden='true'>&times;</span>
                    </button>
                    <h4
                        className='modal-title'
                        ref='title'
                    >
                        <i className='modal-back'></i>Appearance Settings
                    </h4>
                </div>
                <div className='user-settings'>
                    <h3 className='tab-header'>Appearance Settings</h3>
                    <div className='divider-dark first'/>
                    {themeSection}
                    <div className='divider-dark'/>
                </div>
            </div>
        );
    }
}

UserSettingsAppearance.defaultProps = {
    activeSection: ''
};
UserSettingsAppearance.propTypes = {
    activeSection: React.PropTypes.string,
    updateSection: React.PropTypes.func,
    updateTab: React.PropTypes.func
};
