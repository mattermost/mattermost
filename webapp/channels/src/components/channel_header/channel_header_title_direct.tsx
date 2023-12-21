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

const ChannelHeaderTitleDirect = ({
    dmUser,
}: Props) => {
    const currentUser = useSelector(getCurrentUser);
    const teammateNameDisplaySetting = useSelector(getTeammateNameDisplaySetting);
    const displayName = displayUsername(dmUser, teammateNameDisplaySetting)

    return (
        <React.Fragment>
            {currentUser.id !== dmUser?.id && displayName + ' '}
            {currentUser.id === dmUser?.id &&
                <FormattedMessage
                    id='channel_header.directchannel.you'
                    defaultMessage='{displayName} (you) '
                    values={{displayName}}
                />}
            {isGuest(dmUser?.roles ?? '') && <GuestTag/>}
        </React.Fragment>
    );
};

export default memo(ChannelHeaderTitleDirect);
