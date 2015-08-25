// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var UserStore = require('../stores/user_store.jsx');
var SettingItemMin = require('./setting_item_min.jsx');
var SettingItemMax = require('./setting_item_max.jsx');
var client = require('../utils/client.jsx');
var utils = require('../utils/utils.jsx');

module.exports = React.createClass({
    submitTheme: function(e) {
        e.preventDefault();
        var user = UserStore.getCurrentUser();
        if (!user.props) user.props = {};
        user.props.theme = this.state.theme;

        client.updateUser(user,
            function(data) {
                this.props.updateSection("");
                window.location.reload();
            }.bind(this),
            function(err) {
                state = this.getInitialState();
                state.server_error = err;
                this.setState(state);
            }.bind(this)
        );
    },
    updateTheme: function(e) {
        var hex = utils.rgb2hex(e.target.style.backgroundColor);
        this.setState({ theme: hex.toLowerCase() });
    },
    handleClose: function() {
        this.setState({server_error: null});
        this.props.updateTab('general');
    },
    componentDidMount: function() {
        if (this.props.activeSection === "theme") {
            $(this.refs[this.state.theme].getDOMNode()).addClass('active-border');
        }
        $('#user_settings').on('hidden.bs.modal', this.handleClose);
    },
    componentDidUpdate: function() {
        if (this.props.activeSection === "theme") {
            $('.color-btn').removeClass('active-border');
            $(this.refs[this.state.theme].getDOMNode()).addClass('active-border');
        }
    },
    componentWillUnmount: function() {
        $('#user_settings').off('hidden.bs.modal', this.handleClose);
        this.props.updateSection('');
    },
    getInitialState: function() {
        var user = UserStore.getCurrentUser();
        var theme = config.ThemeColors != null ? config.ThemeColors[0] : "#2389d7";
        if (user.props && user.props.theme) {
            theme = user.props.theme;
        }
        return { theme: theme.toLowerCase() };
    },
    render: function() {
        var server_error = this.state.server_error ? this.state.server_error : null;


        var themeSection;
        var self = this;

        if (config.ThemeColors != null) {
            if (this.props.activeSection === 'theme') {
                var theme_buttons = [];

                for (var i = 0; i < config.ThemeColors.length; i++) {
                    theme_buttons.push(<button ref={config.ThemeColors[i]} type="button" className="btn btn-lg color-btn" style={{backgroundColor: config.ThemeColors[i]}} onClick={this.updateTheme} />);
                }

                var inputs = [];

                inputs.push(
                    <li className="setting-list-item">
                        <div className="btn-group" data-toggle="buttons-radio">
                            { theme_buttons }
                        </div>
                    </li>
                );

                themeSection = (
                    <SettingItemMax
                        title="Theme Color"
                        inputs={inputs}
                        submit={this.submitTheme}
                        server_error={server_error}
                        updateSection={function(e){self.props.updateSection("");e.preventDefault;}}
                    />
                );
            } else {
                themeSection = (
                    <SettingItemMin
                        title="Theme Color"
                        describe={this.state.theme}
                        updateSection={function(){self.props.updateSection("theme");}}
                    />
                );
            }
        }

        return (
            <div>
                <div className="modal-header">
                    <button type="button" className="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                    <h4 className="modal-title" ref="title"><i className="modal-back"></i>Appearance Settings</h4>
                </div>
                <div className="user-settings">
                    <h3 className="tab-header">Appearance Settings</h3>
                    <div className="divider-dark first"/>
                    {themeSection}
                    <div className="divider-dark"/>
                </div>
            </div>
        );
    }
});
