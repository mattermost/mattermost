// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from '../utils/utils.jsx';

export default function UserListRow({user, actions}) {
    const details = [];

    const fullName = Utils.getFullName(user);
    if (fullName) {
        details.push(
            <span
                key={`${user.id}__full-name`}
                className='full-name'
            >
                {fullName}
            </span>
        );
    }

    if (user.nickname) {
        const separator = fullName ? ' - ' : '';
        details.push(
            <span
                key={`${user.nickname}__nickname`}
            >
                {separator + user.nickname}
            </span>
        );
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
                className='direct-channel'
                style={{display: 'flex'}}
            >
                <img
                    className='profile-img'
                    src={`/api/v1/users/${user.id}/image?time=${user.update_at}&${Utils.getSessionIndex()}`}
                />
                <div
                    className='user-list-item__details'
                >
                    <div className='more-name'>
                        {user.username}
                    </div>
                    <div className='more-description'>
                        {details}
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
