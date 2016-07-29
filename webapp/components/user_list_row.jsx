// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import UserStore from 'stores/user_store.jsx';
import Constants from 'utils/constants.jsx';
import PreferenceStore from 'stores/preference_store.jsx';
import * as Utils from 'utils/utils.jsx';
import Client from 'client/web_client.jsx';
import React from 'react';

export default function UserListRow({user, teamMember, actions, actionProps}) {
    const nameFormat = PreferenceStore.get(Constants.Preferences.CATEGORY_DISPLAY_SETTINGS, 'name_format', '');

    let name = user.username;
    if (user.nickname && nameFormat === Constants.Preferences.DISPLAY_PREFER_NICKNAME) {
        name = `${user.nickname} (@${user.username})`;
    } else if ((user.first_name || user.last_name) && (nameFormat === Constants.Preferences.DISPLAY_PREFER_NICKNAME || nameFormat === Constants.Preferences.DISPLAY_PREFER_FULL_NAME)) {
        name = `${Utils.getFullName(user)} (@${user.username})`;
    }

    let buttons = null;
    if (actions) {
        buttons = actions.map((Action, index) => {
            return (
                <Action
                    key={index.toString()}
                    user={user}
                    teamMember={teamMember}
                    {...actionProps}
                />
            );
        });
    }

    if (!user.status) {
        var status = UserStore.getStatus(user.id);
        user.status = status ? 'status-' + status : '';
    }
    return (
        <div
            key={user.id}
            className='more-modal__row'
        >
            <span className={`more-modal__image-wrapper ${user.status}`}>
                <img
                    className='more-modal__image'
                    width='38'
                    height='38'
                    src={`${Client.getUsersRoute()}/${user.id}/image?time=${user.update_at}`}
                />
            </span>
            <div
                className='more-modal__details'
            >
                <div className='more-modal__name'>
                    {name}
                </div>
                <div className='more-modal__description'>
                    {user.email}
                </div>
            </div>
            <div
                className='more-modal__actions'
            >
                {buttons}
            </div>
        </div>
    );
}

UserListRow.defaultProps = {
    teamMember: {
        team_id: '',
        roles: ''
    },
    actions: [],
    actionProps: {}
};

UserListRow.propTypes = {
    user: React.PropTypes.object.isRequired,
    teamMember: React.PropTypes.object.isRequired,
    actions: React.PropTypes.arrayOf(React.PropTypes.func),
    actionProps: React.PropTypes.object
};
