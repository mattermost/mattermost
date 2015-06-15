// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.


var utils = require('../utils/utils.jsx');
var client = require('../utils/client.jsx');
var UserStore = require('../stores/user_store.jsx');
var ChannelStore = require('../stores/channel_store.jsx');

module.exports = React.createClass({
    componentDidMount: function() {
        var self = this;
        $(this.refs.modal.getDOMNode()).on('show.bs.modal', function(e) {
            var button = e.relatedTarget;
            var channel_id = button.dataset.channelid;

            var notifyLevel = ChannelStore.getMember(channel_id).notify_level;
            self.setState({ notify_level: notifyLevel, title: button.dataset.title, channel_id: channel_id });
        });
    },
    getInitialState: function() {
        return { notify_level: "", title: "", channel_id: "" };
    },
    handleUpdate: function(e) {
        var channel_id = this.state.channel_id;
        var notify_level = this.state.notify_level;

        var data = {};
        data["channel_id"] = channel_id;
        data["user_id"] = UserStore.getCurrentId();
        data["notify_level"] = this.state.notify_level;

        if (!data["notify_level"] || data["notify_level"].length === 0) return;

        client.updateNotifyLevel(data,
            function(data) {
                var member = ChannelStore.getMember(channel_id);
                member.notify_level = notify_level;
                ChannelStore.setChannelMember(member);
                $(this.refs.modal.getDOMNode()).modal('hide');
            }.bind(this),
            function(err) {
                this.setState({ server_error: err.message });
            }.bind(this)
        );
    },
    handleRadioClick: function(notifyLevel) {
        this.setState({ notify_level: notifyLevel });
        this.refs.modal.getDOMNode().focus();
    },
    handleQuietToggle: function() {
        if (this.state.notify_level === "quiet") {
            this.setState({ notify_level: "none" });
            this.refs.modal.getDOMNode().focus();
        } else {
            this.setState({ notify_level: "quiet" });
            this.refs.modal.getDOMNode().focus();
        }
    },
    render: function() {
        var server_error = this.state.server_error ? <div className='form-group has-error'><label className='control-label'>{ this.state.server_error }</label></div> : null;

        var allActive = "";
        var mentionActive = "";
        var noneActive = "";
        var quietActive = "";
        var desktopHidden = "";

        if (this.state.notify_level === "quiet") {
            desktopHidden = "hidden";
            quietActive = "active";
        } else if (this.state.notify_level === "mention") {
            mentionActive = "active";
        } else if (this.state.notify_level === "none") {
            noneActive = "active";
        } else {
            allActive = "active";
        }

        var self = this;
        return (
            <div className="modal fade" id="channel_notifications" ref="modal" tabIndex="-1" role="dialog" aria-hidden="true">
                <div className="modal-dialog">
                    <div className="modal-content">
                        <div className="modal-header">
                            <button type="button" className="close" data-dismiss="modal">
                                <span aria-hidden="true">&times;</span>
                                <span className="sr-only">Close</span>
                            </button>
                            <h4 className="modal-title">{"Notification Preferences for " + this.state.title}</h4>
                        </div>
                        <div className="modal-body">
                            <div className={desktopHidden}>
                                <span>Desktop Notifications</span>
                                <br/>
                                <div className="btn-group" data-toggle="buttons-radio">
                                    <button className={"btn btn-default "+allActive} onClick={function(){self.handleRadioClick("all")}}>Any activity (default)</button>
                                    <button className={"btn btn-default "+mentionActive} onClick={function(){self.handleRadioClick("mention")}}>Mentions of my name</button>
                                    <button className={"btn btn-default "+noneActive} onClick={function(){self.handleRadioClick("none")}}>Nothing</button>
                                </div>
                                <br/>
                                <br/>
                            </div>
                            <span>Quiet Mode</span>
                            <br/>
                            <div className="btn-group" data-toggle="buttons-checkbox">
                                <button className={"btn btn-default "+quietActive} onClick={this.handleQuietToggle}>Quiet Mode</button>
                            </div>
                            { server_error }
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-primary" onClick={this.handleUpdate}>Done</button>
                        </div>
                    </div>
                </div>
            </div>

        );
    }
});
