// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var SettingItemMin = require('./setting_item_min.jsx');
var SettingItemMax = require('./setting_item_max.jsx');

var utils = require('../utils/utils.jsx');
var client = require('../utils/client.jsx');
var UserStore = require('../stores/user_store.jsx');
var ChannelStore = require('../stores/channel_store.jsx');

module.exports = React.createClass({
    componentDidMount: function() {
        ChannelStore.addChangeListener(this._onChange);

        var self = this;
        $(this.refs.modal.getDOMNode()).on('show.bs.modal', function(e) {
            var button = e.relatedTarget;
            var channel_id = button.getAttribute('data-channelid');

            var notifyLevel = ChannelStore.getMember(channel_id).notify_level;
            var quietMode = false;
            if (notifyLevel === "quiet") quietMode = true;
            self.setState({ notify_level: notifyLevel, quiet_mode: quietMode, title: button.getAttribute('data-title'), channel_id: channel_id });
        });
    },
    componentWillUnmount: function() {
        ChannelStore.removeChangeListener(this._onChange);
    },
    _onChange: function() {
        if (!this.state.channel_id) return;
        var notifyLevel = ChannelStore.getMember(this.state.channel_id).notify_level;
        var quietMode = false;
        if (notifyLevel === "quiet") quietMode = true;

        var newState = this.state;
        newState.notify_level = notifyLevel;
        newState.quiet_mode = quietMode;

        if (!utils.areStatesEqual(this.state, newState)) {
            this.setState(newState);
        }
    },
    updateSection: function(section) {
        this.setState({ activeSection: section });
    },
    getInitialState: function() {
        return { notify_level: "", title: "", channel_id: "", activeSection: "" };
    },
    handleUpdate: function() {
        var channel_id = this.state.channel_id;
        var notify_level = this.state.quiet_mode ? "quiet" : this.state.notify_level;

        var data = {};
        data["channel_id"] = channel_id;
        data["user_id"] = UserStore.getCurrentId();
        data["notify_level"] = notify_level;

        if (!data["notify_level"] || data["notify_level"].length === 0) return;

        client.updateNotifyLevel(data,
            function(data) {
                var member = ChannelStore.getMember(channel_id);
                member.notify_level = notify_level;
                ChannelStore.setChannelMember(member);
                this.updateSection("");
            }.bind(this),
            function(err) {
                this.setState({ server_error: err.message });
            }.bind(this)
        );
    },
    handleRadioClick: function(notifyLevel) {
        this.setState({ notify_level: notifyLevel, quiet_mode: false });
        this.refs.modal.getDOMNode().focus();
    },
    handleQuietToggle: function(quietMode) {
        this.setState({ notify_level: "none", quiet_mode: quietMode });
        this.refs.modal.getDOMNode().focus();
    },
    render: function() {
        var server_error = this.state.server_error ? <div className='form-group has-error'><label className='control-label'>{ this.state.server_error }</label></div> : null;

        var self = this;

        var desktopSection;
        if (this.state.activeSection === 'desktop') {
            var notifyActive = [false, false, false];
            if (this.state.notify_level === "mention") {
                notifyActive[1] = true;
            } else if (this.state.notify_level === "all") {
                notifyActive[0] = true;
            } else {
                notifyActive[2] = true;
            }

            var inputs = [];

            inputs.push(
                <div>
                    <div className="radio">
                        <label>
                            <input type="radio" checked={notifyActive[0]} onClick={function(){self.handleRadioClick("all")}}>For all activity</input>
                        </label>
                        <br/>
                    </div>
                    <div className="radio">
                        <label>
                            <input type="radio" checked={notifyActive[1]} onClick={function(){self.handleRadioClick("mention")}}>Only for mentions</input>
                        </label>
                        <br/>
                    </div>
                    <div className="radio">
                        <label>
                            <input type="radio" checked={notifyActive[2]} onClick={function(){self.handleRadioClick("none")}}>Never</input>
                        </label>
                    </div>
                </div>
            );

            desktopSection = (
                <SettingItemMax
                    title="Send desktop notifications"
                    inputs={inputs}
                    submit={this.handleUpdate}
                    server_error={server_error}
                    updateSection={function(e){self.updateSection("");self._onChange();e.preventDefault();}}
                />
            );
        } else {
            var describe = "";
            if (this.state.notify_level === "mention") {
                describe = "Only for mentions";
            } else if (this.state.notify_level === "all") {
                describe = "For all activity";
            } else {
                describe = "Never";
            }

            desktopSection = (
                <SettingItemMin
                    title="Send desktop notifications"
                    describe={describe}
                    updateSection={function(e){self.updateSection("desktop");e.preventDefault();}}
                />
            );
        }

        var quietSection;
        if (this.state.activeSection === 'quiet') {
            var quietActive = ["",""];
            if (this.state.quiet_mode) {
                quietActive[0] = "active";
            } else {
                quietActive[1] = "active";
            }

            var inputs = [];

            inputs.push(
                <div>
                    <div className="btn-group" data-toggle="buttons-radio">
                        <button className={"btn btn-default "+quietActive[0]} onClick={function(){self.handleQuietToggle(true)}}>On</button>
                        <button className={"btn btn-default "+quietActive[1]} onClick={function(){self.handleQuietToggle(false)}}>Off</button>
                    </div>
                </div>
            );

            inputs.push(
                <div>
                    <br/>
                    Enabling quiet mode will turn off desktop notifications and only mark the channel as unread if you have been mentioned.
                </div>
            );

            quietSection = (
                <SettingItemMax
                    title="Quiet mode"
                    inputs={inputs}
                    submit={this.handleUpdate}
                    server_error={server_error}
                    updateSection={function(e){self.updateSection("");self._onChange();e.preventDefault();}}
                />
            );
        } else {
            var describe = "";
            if (this.state.quiet_mode) {
                describe = "On";
            } else {
                describe = "Off";
            }

            quietSection = (
                <SettingItemMin
                    title="Quiet mode"
                    describe={describe}
                    updateSection={function(e){self.updateSection("quiet");e.preventDefault();}}
                />
            );
        }

        var self = this;
        return (
            <div className="modal fade" id="channel_notifications" ref="modal" tabIndex="-1" role="dialog" aria-hidden="true">
                <div className="modal-dialog settings-modal">
                    <div className="modal-content">
                        <div className="modal-header">
                            <button type="button" className="close" data-dismiss="modal">
                                <span aria-hidden="true">&times;</span>
                                <span className="sr-only">Close</span>
                            </button>
                            <h4 className="modal-title">Notification Preferences for <span className="name">{this.state.title}</span></h4>
                        </div>
                        <div className="modal-body">
                            <div className="settings-table">
                            <div className="settings-content">
                                <div ref="wrapper" className="user-settings">
                                    <br/>
                                    <div className="divider-dark first"/>
                                    {desktopSection}
                                    <div className="divider-light"/>
                                    {quietSection}
                                    <div className="divider-dark"/>
                                </div>
                            </div>
                            </div>
                            { server_error }
                        </div>
                    </div>
                </div>
            </div>
        );
    }
});
