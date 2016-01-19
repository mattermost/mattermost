// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import UserStore from '../stores/user_store.jsx';
import * as Utils from '../utils/utils.jsx';

const messages = defineMessages({
    add: {
        id: 'member_item.add',
        defaultMessage: ' Add'
    },
    makeAdmin: {
        id: 'member_item.makeAdmin',
        defaultMessage: 'Make Admin'
    },
    removeMember: {
        id: 'member_item.removeMember',
        defaultMessage: 'Remove Member'
    },
    member: {
        id: 'member_item.member',
        defaultMessage: 'Member'
    }
});

class MemberListItem extends React.Component {
    constructor(props) {
        super(props);

        this.handleInvite = this.handleInvite.bind(this);
        this.handleRemove = this.handleRemove.bind(this);
        this.handleMakeAdmin = this.handleMakeAdmin.bind(this);
    }
    handleInvite(e) {
        e.preventDefault();
        this.props.handleInvite(this.props.member.id);
    }
    handleRemove(e) {
        e.preventDefault();
        this.props.handleRemove(this.props.member.id);
    }
    handleMakeAdmin(e) {
        e.preventDefault();
        this.props.handleMakeAdmin(this.props.member.id);
    }
    render() {
        const {formatMessage} = this.props.intl;
        var member = this.props.member;
        var isAdmin = this.props.isAdmin;
        var isMemberAdmin = Utils.isAdmin(member.roles);
        var timestamp = UserStore.getCurrentUser().update_at;

        var invite;
        if (this.props.handleInvite) {
            invite = (
                    <a
                        onClick={this.handleInvite}
                        className='btn btn-sm btn-primary'
                    >
                        <i className='glyphicon glyphicon-envelope'/>
                        {formatMessage(messages.add)}
                    </a>
            );
        } else if (isAdmin && !isMemberAdmin && (member.id !== UserStore.getCurrentId())) {
            var self = this;

            let makeAdminOption = null;
            if (this.props.handleMakeAdmin) {
                makeAdminOption = (
                                    <li role='presentation'>
                                        <a
                                            href=''
                                            role='menuitem'
                                            onClick={self.handleMakeAdmin}
                                        >
                                            {formatMessage(messages.makeAdmin)}
                                        </a>
                                    </li>);
            }

            let handleRemoveOption = null;
            if (this.props.handleRemove) {
                handleRemoveOption = (
                                        <li role='presentation'>
                                            <a
                                                href=''
                                                role='menuitem'
                                                onClick={self.handleRemove}
                                            >
                                                {formatMessage(messages.removeMember)}
                                            </a>
                                        </li>);
            }

            invite = (
                        <div className='dropdown member-drop'>
                            <a
                                href='#'
                                className='dropdown-toggle theme'
                                type='button'
                                data-toggle='dropdown'
                                aria-expanded='true'
                            >
                                <span className='fa fa-pencil'></span>
                                <span className='text-capitalize'>{member.roles || formatMessage(messages.member)} </span>
                            </a>
                            <ul
                                className='dropdown-menu member-menu'
                                role='menu'
                            >
                                {makeAdminOption}
                                {handleRemoveOption}
                            </ul>
                        </div>
                    );
        } else {
            invite = <div className='member-role text-capitalize'><span className='fa fa-pencil hidden'></span>{member.roles || formatMessage(messages.member)}</div>;
        }

        return (
            <tr>
                <td className='direct-channel'>
                    <img
                        className='profile-img pull-left'
                        src={'/api/v1/users/' + member.id + '/image?time=' + timestamp + '&' + Utils.getSessionIndex()}
                        height='36'
                        width='36'
                    />
                    <div className='member-name'>{Utils.displayUsername(member.id)}</div>
                    <div className='member-description'>{member.email}</div>
                </td>
                <td className='td--action lg'>{invite}</td>
            </tr>
        );
    }
}

MemberListItem.propTypes = {
    intl: intlShape.isRequired,
    handleInvite: React.PropTypes.func,
    handleRemove: React.PropTypes.func,
    handleMakeAdmin: React.PropTypes.func,
    member: React.PropTypes.object,
    isAdmin: React.PropTypes.bool
};

export default injectIntl(MemberListItem);