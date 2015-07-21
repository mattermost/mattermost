// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var MemberListItem = require('./member_list_item.jsx');

module.exports = React.createClass({
    render: function() {
        var members = [];

        if (this.props.memberList != null) {
            members = this.props.memberList;
        }

        var message = "";
        if (members.length === 0)
            message = <span>No users to add or manage.</span>;

        return (
            <div className="member-list-holder">
                {members.map(function(member) {
                    return <MemberListItem 
                                key={member.id}
                                member={member}
                                isAdmin={this.props.isAdmin}
                                handleInvite={this.props.handleInvite}
                                handleRemove={this.props.handleRemove}
                                handleMakeAdmin={this.props.handleMakeAdmin}
                                allAdminAccess={this.props.allAdminAccess}
                            />;
                }, this)}
                {message}
            </div>
        );
    }
});
