// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
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

    const {formatMessage} = useIntl();

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
        if (!props.currentUser) {
            return <></>;
        }

        if (
            props.currentUser?.first_name?.length > 0 ||
            props.currentUser?.last_name?.length > 0
        ) {
            const name = `${props.currentUser.first_name} ${props.currentUser.last_name}`?.trim();

            return (
                <>
                    <h2 className='userAccountMenu_nameMenuItem_primaryLabel'>
                        {name}
                    </h2>
                    <span className='userAccountMenu_nameMenuItem_secondaryLabel'>
                        {'@' + props.currentUser.username}
                    </span>
                </>
            );
        }

        const username = `@${props.currentUser?.username}`?.trim();

        return (
            <h2 className='userAccountMenu_nameMenuItem_primaryLabel'>
                {username}
            </h2>
        );
    }

    return (
        <>
            <Menu.Item
                className='userAccountMenu_nameMenuItem'
                leadingElement={
                    <Avatar
                        size='lg'
                        url={props.profilePicture}
                        aria-hidden='true'
                    />
                }
                labels={getLabel()}
                aria-label={formatMessage(
                    {
                        id: 'userAccountPopover.nameMenuItem.ariaLabel',
                        defaultMessage: 'Logged in as {username}, click to open user settings',
                    },
                    {username: props.currentUser?.username},
                )}
                onClick={handleClick}
            />
            <Menu.Separator/>
        </>
    );
}
