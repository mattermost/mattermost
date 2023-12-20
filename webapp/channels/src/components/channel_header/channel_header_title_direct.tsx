// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {useSelector} from 'react-redux';
import {FormattedMessage} from 'react-intl';
import {displayUsername, isGuest} from 'mattermost-redux/utils/user_utils';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import GuestTag from 'components/widgets/tag/guest_tag';
import type {UserProfile} from '@mattermost/types/users';

type Props = {
    dmUser?: UserProfile;
}

const ChannelHeaderTitle = ({
    dmUser,
}: Props) => {
    const currentUser = useSelector(getCurrentUser);
    const teammateNameDisplaySetting = useSelector(getTeammateNameDisplaySetting);

    if (currentUser.id === dmUser?.id) {
        return (
            <React.Fragment>
                <FormattedMessage
                    id='channel_header.directchannel.you'
                    defaultMessage='{displayname} (you) '
                    values={{
                        displayname: displayUsername(dmUser, teammateNameDisplaySetting),
                    }}
                />
                {isGuest(dmUser?.roles ?? '') && <GuestTag/>}
            </React.Fragment>
        );
    }

    return (
        <React.Fragment>
            {displayUsername(dmUser, teammateNameDisplaySetting) + ' '}
            {isGuest(dmUser?.roles ?? '') && <GuestTag/>}
        </React.Fragment>
    );
};

export default memo(ChannelHeaderTitle);
