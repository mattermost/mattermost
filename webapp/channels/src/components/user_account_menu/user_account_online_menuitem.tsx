// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {CheckCircleIcon, CheckIcon} from '@mattermost/compass-icons/components';
import type {UserProfile} from '@mattermost/types/users';

import {setStatus} from 'mattermost-redux/actions/users';

import {openModal} from 'actions/views/modals';

import * as Menu from 'components/menu';
import ResetStatusModal from 'components/reset_status_modal';

import {UserStatuses, ModalIdentifiers} from 'utils/constants';

interface Props {
    userId: UserProfile['id'];
    shouldConfirmBeforeStatusChange: boolean;
    isStatusOnline: boolean;
}

export default function UserAccountOnlineMenuItem(props: Props) {
    const dispatch = useDispatch();

    const {formatMessage} = useIntl();

    function handleClick() {
        if (props.shouldConfirmBeforeStatusChange) {
            dispatch(openModal({
                modalId: ModalIdentifiers.RESET_STATUS,
                dialogType: ResetStatusModal,
                dialogProps: {
                    newStatus: UserStatuses.ONLINE,
                },
            }));
        } else {
            dispatch(setStatus({
                user_id: props.userId,
                status: UserStatuses.ONLINE,
            }));
        }
    }

    const trailingElement = useMemo(() => {
        if (props.isStatusOnline) {
            return (
                <CheckIcon
                    size={16}
                    className='userAccountMenu_menuItemTrailingCheckIcon'
                    aria-hidden='true'
                />
            );
        }

        return null;
    }, [props.isStatusOnline]);

    const ariaLabel = useMemo(() => {
        if (props.isStatusOnline) {
            return formatMessage({
                id: 'userAccountMenu.onlineMenuItem.ariaLabelChecked',
                defaultMessage: 'Current status is set to "Online"',
            });
        }

        return formatMessage({
            id: 'userAccountMenu.onlineMenuItem.ariaLabelUnchecked',
            defaultMessage: 'Click to set status to "Online"',
        });
    }, [props.isStatusOnline, formatMessage]);

    return (
        <Menu.Item
            leadingElement={
                <CheckCircleIcon
                    size='18'
                    className='userAccountMenu_onlineMenuItem_icon'
                    aria-hidden='true'
                />
            }
            labels={
                <FormattedMessage
                    id='userAccountMenu.onlineMenuItem.label'
                    defaultMessage='Online'
                />
            }
            trailingElements={trailingElement}
            aria-label={ariaLabel}
            onClick={handleClick}
        />
    );
}
