// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Constants from '../utils/constants.jsx';
import PreferenceStore from '../stores/preference_store.jsx';
import * as Utils from '../utils/utils.jsx';

export default function UserListRow({user, actions}) {
    const nameFormat = PreferenceStore.get(Constants.Preferences.CATEGORY_DISPLAY_SETTINGS, 'name_format', '');

    let name = user.username;
    if (user.nickname && nameFormat === Constants.Preferences.DISPLAY_PREFER_NICKNAME) {
        name = `${user.nickname} (@${user.username})`;
    } else if ((user.first_name || user.last_name) && (nameFormat === Constants.Preferences.DISPLAY_PREFER_NICKNAME || nameFormat === Constants.Preferences.DISPLAY_PREFER_FULL_NAME)) {
        name = `${Utils.getFullName(user)} (@${user.username})`;
    }

    const buttons = actions.map((Action, index) => {
        return (
            <Action
                key={index.toString()}
                user={user}
            />
        );
    });

    return (
        <tr>
            <td
                key={user.id}
                style={{display: 'flex'}}
            >
                <img
                    className='profile-img'
                    src={`/api/v1/users/${user.id}/image?time=${user.update_at}`}
                />
                <div
                    className='user-list-item__details'
                >
                    <div className='more-name'>
                        {name}
                    </div>
                    <div className='more-description'>
                        {user.email}
                    </div>
                </div>
                <div
                    className='user-list-item__actions'
                >
                    {buttons}
                </div>
            </td>
        </tr>
    );
}

UserListRow.defaultProps = {
    actions: []
};

UserListRow.propTypes = {
    user: React.PropTypes.object.isRequired,
    actions: React.PropTypes.arrayOf(React.PropTypes.func)
};
