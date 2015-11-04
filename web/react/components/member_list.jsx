// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var MemberListItem = require('./member_list_item.jsx');

export default class MemberList extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        var members = [];

        if (this.props.memberList !== null) {
            members = this.props.memberList;
        }

        var message = '';
        if (members.length === 0) {
            message = <span>No users to add.</span>;
        }

        return (
            <table className='table more-table member-list-holder'>
                <tbody>
                {members.map(function mymembers(member) {
                    return (
                        <MemberListItem
                            key={member.id}
                            member={member}
                            isAdmin={this.props.isAdmin}
                            handleInvite={this.props.handleInvite}
                            handleRemove={this.props.handleRemove}
                            handleMakeAdmin={this.props.handleMakeAdmin}
                        />
                    );
                }, this)}
                </tbody>
                {message}
            </table>
        );
    }
}

MemberList.propTypes = {
    memberList: React.PropTypes.array,
    isAdmin: React.PropTypes.bool,
    handleInvite: React.PropTypes.func,
    handleRemove: React.PropTypes.func,
    handleMakeAdmin: React.PropTypes.func
};
