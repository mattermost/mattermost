// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var AdminNavbarDropdown = require('./admin_navbar_dropdown.jsx');
var UserStore = require('../../stores/user_store.jsx');

export default class SidebarHeader extends React.Component {
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
        var me = UserStore.getCurrentUser();
        var profilePicture = null;

        if (!me) {
            return null;
        }

        if (me.last_picture_update) {
            profilePicture = (
                <img
                    className='user__picture'
                    src={'/api/v1/users/' + me.id + '/image?time=' + me.update_at}
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
                        <div className='team__name'>{'System Console'}</div>
                    </div>
                </a>
                <AdminNavbarDropdown ref='dropdown' />
            </div>
        );
    }
}