// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import AdminNavbarDropdown from './admin_navbar_dropdown.jsx';
import UserStore from '../../stores/user_store.jsx';
import * as Utils from '../../utils/utils.jsx';

const messages = defineMessages({
    console: {
        id: 'admin.sidebarHeader.systemConsole',
        defaultMessage: 'System Console'
    }
});

class SidebarHeader extends React.Component {
    constructor(props) {
        super(props);

        this.toggleDropdown = this.toggleDropdown.bind(this);

        this.state = {};
    }

    toggleDropdown(e) {
        e.preventDefault();

        if (this.refs.dropdown.blockToggle) {
            this.refs.dropdown.blockToggle = false;
            return;
        }

        $('.team__header').find('.dropdown-toggle').dropdown('toggle');
    }

    render() {
        const {formatMessage} = this.props.intl;

        var me = UserStore.getCurrentUser();
        var profilePicture = null;

        if (!me) {
            return null;
        }

        if (me.last_picture_update) {
            profilePicture = (
                <img
                    className='user__picture'
                    src={'/api/v1/users/' + me.id + '/image?time=' + me.update_at + '&' + Utils.getSessionIndex()}
                />
            );
        }

        return (
            <div className='team__header theme'>
                <a
                    href='#'
                    onClick={this.toggleDropdown}
                >
                    {profilePicture}
                    <div className='header__info'>
                        <div className='user__name'>{'@' + me.username}</div>
                        <div className='team__name'>{formatMessage(messages.console)}</div>
                    </div>
                </a>
                <AdminNavbarDropdown ref='dropdown' />
            </div>
        );
    }
}

SidebarHeader.propTypes = {
    intl: intlShape.isRequired
};

export default injectIntl(SidebarHeader);