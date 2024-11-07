// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch} from 'react-redux';

import type {UserProfile} from '@mattermost/types/users';

import {openModal} from 'actions/views/modals';

import * as Menu from 'components/menu';
import UserSettingsModal from 'components/user_settings/modal';
import Avatar from 'components/widgets/users/avatar/avatar';

import {ModalIdentifiers} from 'utils/constants';

interface Props {
    currentUser?: UserProfile;
    profilePicture?: string;
}

export default function UserAccountNameMenuItem(props: Props) {
    const dispatch = useDispatch();

    if (!props.currentUser) {
        return null;
    }

    function handleClick() {
        dispatch(openModal({
            modalId: ModalIdentifiers.USER_SETTINGS,
            dialogType: UserSettingsModal,
            dialogProps: {isContentProductSettings: false},
        }));
    }

    function getLabel() {
        if (props.currentUser?.first_name || props.currentUser?.last_name) {
            const name = `${props.currentUser.first_name} ${props.currentUser.last_name}`?.trim();
            return (
                <>
                    <h2 className='userAccountMenu__nameMenuItem__primaryLabel'>
                        {name}
                    </h2>
                    <span
                        className='userAccountMenu__nameMenuItem__secondaryLabel'
                    >
                        {'@' + props.currentUser.username}
                    </span>
                </>
            );
        }

        const username = `@${props.currentUser?.username}`?.trim();

        return (
            <h2 className='userAccountMenu__nameMenuItem__primaryLabel'>
                {username}
            </h2>
        );
    }

    return (
        <>
            <Menu.Item
                className='userAccountMenu__nameMenuItem'
                leadingElement={
                    <Avatar
                        size='lg'
                        url={props.profilePicture}
                        className='userAccountMenu__avatarMenuItem'
                    />
                }
                labels={getLabel()}
                onClick={handleClick}
            />
            <Menu.Separator/>
        </>
    );
}
