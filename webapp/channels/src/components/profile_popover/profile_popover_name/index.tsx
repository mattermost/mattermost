// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserProfile} from '@mattermost/types/users';

import BotDescription from './bot_description';
import FullName from './full_name';
import Position from './position';
import UserName from './user_name';

type Props = {
    haveOverrideProp: boolean;
    user: UserProfile;
    fullname: string;
}
const ProfilePopoverName = ({
    user,
    haveOverrideProp,
    fullname,
}: Props) => {
    return (
        <>
            <FullName
                fullname={fullname}
                remoteId={user.remote_id}
                username={user.username}
            />
            <BotDescription
                botDescription={user.bot_description}
                haveOverrideProp={haveOverrideProp}
                isBot={user.is_bot}
            />
            <UserName
                hasFullName={Boolean(fullname)}
                username={user.username}
            />
            <Position
                haveOverrideProp={haveOverrideProp}
                position={user.position}
            />
        </>
    );
};

export default ProfilePopoverName;
