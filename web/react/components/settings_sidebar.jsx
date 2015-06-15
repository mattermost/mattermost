// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

module.exports = React.createClass({
    updateTab: function(tab) {
        this.props.updateTab(tab);
        $('.settings-modal').addClass('display--content');
    },
    render: function() {
        var self = this;
        return (
            <div className="">
                <ul className="nav nav-pills nav-stacked">
                    <li className={this.props.activeTab == 'general' ? 'active' : ''}><a href="#" onClick={function(){self.updateTab("general");}}><i className="glyphicon glyphicon-cog"></i>General</a></li>
                    <li className={this.props.activeTab == 'security' ? 'active' : ''}><a href="#" onClick={function(){self.updateTab("security");}}><i className="glyphicon glyphicon-lock"></i>Security</a></li>
                    <li className={this.props.activeTab == 'notifications' ? 'active' : ''}><a href="#" onClick={function(){self.updateTab("notifications");}}><i className="glyphicon glyphicon-exclamation-sign"></i>Notifications</a></li>
                    <li className={this.props.activeTab == 'sessions' ? 'active' : ''}><a href="#" onClick={function(){self.updateTab("sessions");}}><i className="glyphicon glyphicon-globe"></i>Sessions</a></li>
                    <li className={this.props.activeTab == 'activity_log' ? 'active' : ''}><a href="#" onClick={function(){self.updateTab("activity_log");}}><i className="glyphicon glyphicon-time"></i>Activity Log</a></li>
                    <li className={this.props.activeTab == 'appearance' ? 'active' : ''}><a href="#" onClick={function(){self.updateTab("appearance");}}><i className="glyphicon glyphicon-wrench"></i>Appearance</a></li>
                </ul>
            </div>
        );
    }
});
