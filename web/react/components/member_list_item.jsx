// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var ChannelStore = require('../stores/channel_store.jsx');
var UserStore = require('../stores/user_store.jsx');

module.exports = React.createClass({
    handleInvite: function() {
        this.props.handleInvite(this.props.member.id);
    },
    handleRemove: function() {
        this.props.handleRemove(this.props.member.id);
    },
    handleMakeAdmin: function() {
        this.props.handleMakeAdmin(this.props.member.id);
    },
    render: function() {

        var member = this.props.member;
        var isAdmin = this.props.isAdmin;
        var isMemberAdmin = member.roles.indexOf("admin") > -1;

        if (member.roles === '') {
            member.roles = 'Member';
        } else {
            member.roles = member.roles.charAt(0).toUpperCase() + member.roles.slice(1);
        }

        var invite;
        if (member.invited && this.props.handleInvite) {
            invite = <span className="member-role">Added</span>;
        } else if (this.props.handleInvite) {
            invite = <a onClick={this.handleInvite} className="btn btn-sm btn-primary member-invite"><i className="glyphicon glyphicon-envelope"/>  Add</a>;
        } else if (isAdmin && !isMemberAdmin && (member.id != UserStore.getCurrentId())) {
            var self = this;
            invite = (
                        <div className="dropdown member-drop">
                            <a href="#" className="dropdown-toggle theme" type="button" id="channel_header_dropdown" data-toggle="dropdown" aria-expanded="true">
                            <span>{member.roles}  </span>
                                <span className="caret"></span>
                            </a>
                            <ul className="dropdown-menu member-menu" role="menu" aria-labelledby="channel_header_dropdown">
                                { this.props.handleMakeAdmin ?
                                <li role="presentation"><a role="menuitem" onClick={self.handleMakeAdmin}>Make Admin</a></li>
                                : "" }
                                { this.props.handleRemove ?
                                <li role="presentation"><a role="menuitem" onClick={self.handleRemove}>Remove Member</a></li>
                                : "" }
                            </ul>
                        </div>
                    );
        } else {
            invite = <div className="member-drop"><span>{member.roles} </span><span className="caret invisible"></span></div>;
        }

        var email = member.email.length > 0 ? member.email : "";

        return (
            <div className="row member-div">
                <img className="post-profile-img pull-left" src={"/api/v1/users/" + member.id + "/image"} height="36" width="36" />
                <span className="member-name">{member.username}</span>
                <span className="member-email">{email}</span>
                { invite }
            </div>
        );
    }
});
