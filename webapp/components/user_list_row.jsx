// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ProfilePicture from 'components/profile_popover/picture_profile_popover.jsx';

import UserStore from 'stores/user_store.jsx';
import PreferenceStore from 'stores/preference_store.jsx';

import Constants from 'utils/constants.jsx';
import * as Utils from 'utils/utils.jsx';
import Client from 'client/web_client.jsx';

import React from 'react';
import {FormattedHTMLMessage} from 'react-intl';

export default function UserListRow({user, extraInfo, actions, actionProps, actionUserProps}) {
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
                    {...actionProps}
                    {...actionUserProps}
                />
            );
        });
    }

    // QUICK HACK, NEEDS A PROP FOR TOGGLING STATUS
    let email = user.email;
    let emailStyle = 'more-modal__description';
    let status;
    if (extraInfo && extraInfo.length > 0) {
        email = (
            <FormattedHTMLMessage
                id='admin.user_item.emailTitle'
                defaultMessage='<strong>Email:</strong> {email}'
                values={{
                    email: user.email
                }}
            />
        );
        emailStyle = '';
    } else if (user.status) {
        status = user.status;
    } else {
        status = UserStore.getStatus(user.id);
    }

    return (
        <div
            key={user.id}
            className='more-modal__row'
        >
            <ProfilePicture
                src={`${Client.getUsersRoute()}/${user.id}/image?time=${user.last_picture_update}`}
                status={status}
                width='32'
                height='32'
            />
            <div
                className='more-modal__details'
            >
                <div className='more-modal__name'>
                    {name}
                </div>
                <div className={emailStyle}>
                    {email}
                </div>
                {extraInfo}
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
    extraInfo: [],
    actions: [],
    actionProps: {},
    actionUserProps: {}
};

UserListRow.propTypes = {
    user: React.PropTypes.object.isRequired,
    extraInfo: React.PropTypes.arrayOf(React.PropTypes.object),
    actions: React.PropTypes.arrayOf(React.PropTypes.func),
    actionProps: React.PropTypes.object,
    actionUserProps: React.PropTypes.object
};
