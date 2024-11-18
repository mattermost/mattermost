// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserProfile} from '@mattermost/types/users';

import ChannelHeaderMenuItems from './channel_header_menu_items';

type Props = {
    dmUser?: UserProfile;
    gmMembers?: UserProfile[];
    archivedIcon?: JSX.Element;
    sharedIcon?: JSX.Element;
}

export default function ChannelHeaderMenu(props: Props): JSX.Element | null {
    return (
        <ChannelHeaderMenuItems
            dmUser={props.dmUser}
            gmMembers={props.gmMembers}
            archivedIcon={props.archivedIcon}
            sharedIcon={props.sharedIcon}
            isMobile={false}
        />
    );
}
