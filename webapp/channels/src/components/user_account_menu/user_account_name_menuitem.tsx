// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import {openModal} from 'actions/views/modals';

import * as Menu from 'components/menu';
import UserSettingsModal from 'components/user_settings/modal';
import Avatar from 'components/widgets/users/avatar/avatar';

import {ModalIdentifiers} from 'utils/constants';

interface Props {
    profilePicture?: string;
}

export default function UserAccountNameMenuItem(props: Props) {
    const dispatch = useDispatch();

    const {formatMessage} = useIntl();

    const currentUser = useSelector(getCurrentUser);

    if (!currentUser) {
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
        if (!currentUser) {
            return <></>;
        }

        if (
            currentUser.first_name?.length > 0 ||
            currentUser.last_name?.length > 0
        ) {
            const name = `${currentUser.first_name} ${currentUser.last_name}`?.trim();

            return (
                <>
                    <h2 className='userAccountMenu_nameMenuItem_primaryLabel'>
                        {name}
                    </h2>
                    <span className='userAccountMenu_nameMenuItem_secondaryLabel'>
                        {'@' + currentUser.username}
                    </span>
                </>
            );
        }

        const username = `@${currentUser.username}`?.trim();

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
                    {username: currentUser.username},
                )}
                onClick={handleClick}
            />
            <Menu.Separator/>
        </>
    );
}
