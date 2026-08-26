// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import styled from 'styled-components';

import type {UserProfile} from '@mattermost/types/users';

import {getUser as selectUser, makeDisplayNameGetter} from 'mattermost-redux/selectors/entities/users';

import UserRow from 'components/widgets/users/user_row';

import {A11yCustomEventTypes} from 'utils/constants';
import type {A11yFocusEventDetail} from 'utils/constants';

import type {GlobalState} from 'types/store';

export type Props = {
    userIds: Array<UserProfile['id']>;

    /**
     * Overflow users the caller counted but did not name, from Avatars' `totalUsers`.
     * They cannot be listed, so they are reported as a remainder.
     */
    unnamedCount: number;

    hide: () => void;
    returnFocus: () => void;
};

const displayNameGetter = makeDisplayNameGetter();

const OverflowUsersPopover = ({userIds, unnamedCount, hide, returnFocus}: Props) => {
    const {formatMessage} = useIntl();
    const closeRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        document.dispatchEvent(new CustomEvent<A11yFocusEventDetail>(
            A11yCustomEventTypes.FOCUS, {
                detail: {
                    target: closeRef.current,
                    keyboardOnly: true,
                },
            },
        ));
    }, []);

    const handleClose = () => {
        hide();
        returnFocus();
    };

    return (
        <Body data-testid='avatars-overflow-popover'>
            <Header>
                <Title>
                    <FormattedMessage
                        id='avatars.overflowPopover.title'
                        defaultMessage='{count, plural, one {# other} other {# others}}'
                        values={{count: userIds.length + unnamedCount}}
                    />
                </Title>
                <CloseButton
                    className='btn btn-sm btn-compact btn-icon'
                    aria-label={formatMessage({id: 'avatars.overflowPopover.close', defaultMessage: 'Close list'})}
                    onClick={handleClose}
                    ref={closeRef}
                >
                    <i className='icon icon-close'/>
                </CloseButton>
            </Header>
            <UserList role='list'>
                {userIds.map((userId) => (
                    <OverflowUser
                        key={userId}
                        userId={userId}
                    />
                ))}
            </UserList>
            {unnamedCount > 0 && (
                <Remainder>
                    <FormattedMessage
                        id='avatars.overflowPopover.unnamed'
                        defaultMessage='and {count, plural, one {# more person} other {# more people}}'
                        values={{count: unnamedCount}}
                    />
                </Remainder>
            )}
        </Body>
    );
};

// Selects its own user so the list never builds a new array identity per render.
const OverflowUser = ({userId}: {userId: UserProfile['id']}) => {
    const user = useSelector((state: GlobalState) => selectUser(state, userId)) as UserProfile | undefined;
    const displayName = useSelector((state: GlobalState) => displayNameGetter(state, true)(user));

    return (
        <UserListItem role='listitem'>
            <UserRow
                userId={userId}
                username={user?.username}
                displayName={displayName}
                hideStatus={user?.is_bot}
            />
        </UserListItem>
    );
};

const Body = styled.div`
    width: 264px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;
    background: var(--center-channel-bg);
    box-shadow: var(--elevation-4);
`;

const Header = styled.div`
    display: flex;
    align-items: center;
    padding: 16px 20px 8px;
    font-family: 'Metropolis', sans-serif;
    font-size: 16px;
    font-weight: 600;
`;

const Title = styled.span`
    flex: 1 1 auto;
`;

const CloseButton = styled.button`
    display: flex;
    width: 28px;
    height: 28px;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    margin-left: 4px;

    svg {
        width: 18px;
    }
`;

const UserList = styled.div`
    max-height: 320px;
    padding: 4px 0;
    border-top: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    overflow-y: auto;
`;

const UserListItem = styled.div`
    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }
`;

const Remainder = styled.div`
    padding: 8px 20px 12px;
    border-top: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    color: rgba(var(--center-channel-color-rgb), 0.75);
    font-size: 12px;
`;

export default React.memo(OverflowUsersPopover);
