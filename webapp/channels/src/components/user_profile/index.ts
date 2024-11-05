// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ConnectedProps} from 'react-redux';
import {connect} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';
import type {UserProfile as UserProfileType} from '@mattermost/types/users';

import {getTheme} from 'mattermost-redux/selectors/entities/preferences';
import {getUser, makeGetDisplayName} from 'mattermost-redux/selectors/entities/users';

import type {GlobalState} from 'types/store';

import UserProfile from './user_profile';

export type OwnProps = {
    userId: UserProfileType['id'];
    overwriteName?: string;
    overwriteIcon?: string;
    disablePopover?: boolean;
    displayUsername?: boolean;
    colorize?: boolean;
    hideStatus?: boolean;
    channelId?: Channel['id'];
}

function makeMapStateToProps() {
    const getDisplayName = makeGetDisplayName();

    return (state: GlobalState, ownProps: OwnProps) => {
        const user = getUser(state, ownProps.userId);
        const theme = getTheme(state);

        return {
            displayName: getDisplayName(state, ownProps.userId, true),
            user,
            theme,
            isShared: Boolean(user && user.remote_id),
        };
    };
}

const connector = connect(makeMapStateToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connect(makeMapStateToProps)(UserProfile);
