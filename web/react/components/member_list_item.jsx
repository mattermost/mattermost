// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var ChannelStore = require('../stores/channel_store.jsx');
var UserStore = require('../stores/user_store.jsx');

module.exports = React.createClass({
    displayName: 'MemberListItem',
    handleInvite: function(e) {
        e.preventDefault();
        this.props.handleInvite(this.props.member.id);
    },
    handleRemove: function(e) {
        e.preventDefault();
        this.props.handleRemove(this.props.member.id);
    },
    handleMakeAdmin: function(e) {
        e.preventDefault();
        this.props.handleMakeAdmin(this.props.member.id);
    },
    render: function() {

        var member = this.props.member;
        var isAdmin = this.props.isAdmin;
        var isMemberAdmin = member.roles.indexOf("admin") > -1;
        var timestamp = UserStore.getCurrentUser().update_at;

        var invite;
        if (member.invited && this.props.handleInvite) {
            invite = <span className="member-role">Added</span>;
        } else if (this.props.handleInvite) {
            invite = <a onClick={this.handleInvite} className="btn btn-sm btn-primary member-invite"><i className="glyphicon glyphicon-envelope"/>  Add</a>;
        } else if ((isAdmin || this.props.allAdminAccess) && !isMemberAdmin && (member.id != UserStore.getCurrentId())) {
            var self = this;
            invite = (
                        <div className="dropdown member-drop">
                            <a href="#" className="dropdown-toggle theme" type="button" id="channel_header_dropdown" data-toggle="dropdown" aria-expanded="true">
                                <span className="text-capitalize">{member.roles || 'Member'}  </span>
                                <span className="caret"></span>
                            </a>
                            <ul className="dropdown-menu member-menu" role="menu" aria-labelledby="channel_header_dropdown">
                                { this.props.handleMakeAdmin ?
                                <li role="presentation"><a href="" role="menuitem" onClick={self.handleMakeAdmin}>Make Admin</a></li>
                                : null }
                                { this.props.handleRemove ?
                                <li role="presentation"><a href="" role="menuitem" onClick={self.handleRemove}>Remove Member</a></li>
                                : null }
                            </ul>
                        </div>
                    );
        } else {
            invite = <div className="member-role text-capitalize">{member.roles || 'Member'}<span className="caret hidden"></span></div>;
        }

        return (
            <div className="row member-div">
                <img className="post-profile-img pull-left" src={"/api/v1/users/" + member.id + "/image?time=" + timestamp} height="36" width="36" />
                <span className="member-name">{member.username}</span>
                <span className="member-email">{member.email}</span>
                { invite }
            </div>
        );
    }
});
