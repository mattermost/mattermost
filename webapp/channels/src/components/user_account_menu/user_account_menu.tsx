// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {MouseEvent, KeyboardEvent} from 'react';
import {useIntl} from 'react-intl';

import CustomStatusModal from 'components/custom_status/custom_status_modal';
import * as Menu from 'components/menu';

import {ModalIdentifiers, UserStatuses} from 'utils/constants';

import UserAccountAwayMenuItem from './user_account_away_menuitem';
import UserAccountCustomStatusMenuItem from './user_account_custom_status_menuitem';
import UserAccountDndMenuItem from './user_account_dnd_menuitem';
import UserAccountLogoutMenuItem from './user_account_logout_menuitem';
import UserAccountMenuButton from './user_account_menuButton';
import UserAccountNameMenuItem from './user_account_name_menuitem';
import UserAccountOfflineMenuItem from './user_account_offline_menuitem';
import UserAccountOnlineMenuItem from './user_account_online_menuitem';
import UserAccountOutOfOfficeMenuItem from './user_account_out_of_office_menuitem';
import UserAccountProfileMenuItem from './user_account_profile_menuitem';
import UserAccountSetCustomStatusMenuItem from './user_account_set_custom_status_menuitem';

import type {PropsFromRedux} from './index';

import './user_account_menu.scss';

type Props = PropsFromRedux;

export const ELEMENT_ID_FOR_USER_ACCOUNT_MENU_BUTTON = 'userAccountMenuButton';
export const ELEMENT_ID_FOR_USER_ACCOUNT_MENU = 'userAccountMenu';

export default function UserAccountMenu(props: Props) {
    const {formatMessage} = useIntl();

    function openCustomStatusModal(event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) {
        event.stopPropagation();
        props.actions.openModal({
            modalId: ModalIdentifiers.CUSTOM_STATUS,
            dialogType: CustomStatusModal,
        });
    }

    const isCustomStatusSet = !props.isCustomStatusExpired && props.customStatus && (props.customStatus.text?.length > 0 || props.customStatus.emoji?.length > 0);
    const shouldConfirmBeforeStatusChange = props.autoResetPref === '' && props.status === UserStatuses.OUT_OF_OFFICE;

    return (
        <Menu.Container
            menuButton={{
                id: ELEMENT_ID_FOR_USER_ACCOUNT_MENU_BUTTON,
                class: classNames('userAccountMenu_menuButton', {
                    withCustomStatus: isCustomStatusSet,
                }),
                'aria-label': formatMessage({id: 'userAccountMenu.menuButton.ariaLabel', defaultMessage: 'User\'s account menu'}),
                'aria-describedby': 'userAccountMenuButtonDescribedBy',
                children: (
                    <UserAccountMenuButton
                        profilePicture={props.profilePicture}
                        openCustomStatusModal={openCustomStatusModal}
                        status={props.status}
                    />
                ),
            }}
            menu={{
                id: ELEMENT_ID_FOR_USER_ACCOUNT_MENU,
                width: '264px',
            }}
            anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'right',
            }}
            transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
            }}
        >
            <UserAccountNameMenuItem
                profilePicture={props.profilePicture}
            />
            <Menu.Separator/>
            {props.status === UserStatuses.OUT_OF_OFFICE && (
                <UserAccountOutOfOfficeMenuItem
                    userId={props.userId}
                    shouldConfirmBeforeStatusChange={shouldConfirmBeforeStatusChange}
                />
            )}
            {props.status === UserStatuses.OUT_OF_OFFICE && (
                <Menu.Separator/>
            )}
            {props.isCustomStatusEnabled && !isCustomStatusSet && (
                <UserAccountSetCustomStatusMenuItem
                    openCustomStatusModal={openCustomStatusModal}
                />
            )}
            {props.isCustomStatusEnabled && isCustomStatusSet && (
                <UserAccountCustomStatusMenuItem
                    timezone={props.timezone}
                    customStatus={props.customStatus}
                    openCustomStatusModal={openCustomStatusModal}
                />
            )}
            {props.isCustomStatusEnabled && (
                <Menu.Separator/>
            )}
            <UserAccountOnlineMenuItem
                userId={props.userId}
                shouldConfirmBeforeStatusChange={shouldConfirmBeforeStatusChange}
                isStatusOnline={props.status === UserStatuses.ONLINE}
            />
            <UserAccountAwayMenuItem
                userId={props.userId}
                shouldConfirmBeforeStatusChange={shouldConfirmBeforeStatusChange}
                isStatusAway={props.status === UserStatuses.AWAY}
            />
            <UserAccountDndMenuItem
                userId={props.userId}
                shouldConfirmBeforeStatusChange={shouldConfirmBeforeStatusChange}
                timezone={props.timezone}
                isStatusDnd={props.status === UserStatuses.DND}
            />
            <UserAccountOfflineMenuItem
                userId={props.userId}
                shouldConfirmBeforeStatusChange={shouldConfirmBeforeStatusChange}
                isStatusOffline={props.status === UserStatuses.OFFLINE}
            />
            <Menu.Separator/>
            <UserAccountProfileMenuItem
                userId={props.userId}
            />
            <Menu.Separator/>
            <UserAccountLogoutMenuItem/>
        </Menu.Container>
    );
}
