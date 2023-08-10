// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Client4} from 'mattermost-redux/client';

import ProfilePicture from 'components/profile_picture';

import * as Utils from 'utils/utils';

import type {UserProfile} from '@mattermost/types/users';
import './admin_user_card.scss';

type BulletProps = {
    user: UserProfile;
}

export type Props = {
    user: UserProfile;
    body?: React.ReactNode;
    footer?: React.ReactNode;
}

const Bullet: React.FC<BulletProps> = (props: BulletProps) => {
    if ((props.user.first_name || props.user.last_name) && props.user.nickname) {
        return (<span>{' • '}</span>);
    }
    return null;
};

const AdminUserCard: React.FC<Props> = (props: Props) => {
    return (
        <div className='AdminUserCard'>
            <div className='AdminUserCard__header'>
                <ProfilePicture
                    src={Client4.getProfilePictureUrl(props.user.id, props.user.last_picture_update)}
                    size='xxl'
                    wrapperClass='admin-user-card'
                    userId={props.user.id}
                />
                <div className='AdminUserCard__user-info'>
                    <span>{props.user.first_name} {props.user.last_name}</span>
                    <Bullet user={props.user}/>
                    <span className='AdminUserCard__user-nickname'>{props.user.nickname}</span>
                </div>
                <div className='AdminUserCard__user-id'>
                    {Utils.localizeMessage('admin.userManagement.userDetail.userId', 'User ID:')} {props.user.id}
                </div>
            </div>
            <div className='AdminUserCard__body'>
                {props.body}
            </div>
            <div className='AdminUserCard__footer'>
                {props.footer}
            </div>
        </div>);
};

export default AdminUserCard;
