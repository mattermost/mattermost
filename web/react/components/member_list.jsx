// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import MemberListItem from './member_list_item.jsx';

const messages = defineMessages({
    noUsers: {
        id: 'member_list.noUsers',
        defaultMessage: 'No users to add.'
    }
});

class MemberList extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        const {formatMessage} = this.props.intl;
        var members = [];

        if (this.props.memberList !== null) {
            members = this.props.memberList;
        }

        var message = null;
        if (members.length === 0) {
            message = <tr><td>{formatMessage(messages.noUsers)}</td></tr>;
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
                    {message}
                </tbody>
            </table>
        );
    }
}

MemberList.propTypes = {
    intl: intlShape.isRequired,
    memberList: React.PropTypes.array,
    isAdmin: React.PropTypes.bool,
    handleInvite: React.PropTypes.func,
    handleRemove: React.PropTypes.func,
    handleMakeAdmin: React.PropTypes.func
};

export default injectIntl(MemberList);