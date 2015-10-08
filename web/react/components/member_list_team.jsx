// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

const MemberListTeamItem = require('./member_list_team_item.jsx');

export default class MemberListTeam extends React.Component {
    render() {
        const memberList = this.props.users.map(function makeListItem(user) {
            return (
                <MemberListTeamItem
                    key={user.id}
                    user={user}
                />
            );
        }, this);

        return (
            <div className='member-list-holder'>
                {memberList}
            </div>
        );
    }
}

MemberListTeam.propTypes = {
    users: React.PropTypes.arrayOf(React.PropTypes.object).isRequired
};
