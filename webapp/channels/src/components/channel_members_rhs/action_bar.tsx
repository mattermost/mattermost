// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect} from 'react';
import {FormattedMessage} from 'react-intl';

import styled from 'styled-components';

import Constants from 'utils/constants';
import {isKeyPressed} from 'utils/keyboard';

const Title = styled.div`
    flex:1;
    font-family: 'Open Sans', sans-serif;
    font-weight: 600;
    font-size: 14px;
    line-height: 20px;
`;

const Actions = styled.div`
    button + button {
        margin-left: 8px;
    }
`;

const Button = styled.button`
    border: none;
    background: transparent;
    width: fit-content;
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    line-height: 16px;
    &.add-members, &.manage-members-done {
        background-color: var(--button-bg);
        color: var(--button-color);
        &:hover, &:active, &:focus {
            background: linear-gradient(0deg, rgba(var(--center-channel-color-rgb), 0.16), rgba(var(--center-channel-color-rgb), 0.16)), var(--button-bg);
            color: var(--button-color);
        }
    }
    &.manage-members {
        background: rgba(var(--button-bg-rgb),0.08);
        color: var(--button-bg);
        &:hover, &:focus {
            background: rgba(var(--button-bg-rgb),0.12);
        }
        &:active {
            background: rgba(var(--button-bg-rgb),0.16);
        }
    }
`;

const ButtonIcon = styled.i`
    font-size: 14.4px;
`;

export interface Props {
    className?: string;
    channelType: string;
    membersCount: number;
    canManageMembers: boolean;
    editing: boolean;
    actions: {
        startEditing: () => void;
        stopEditing: () => void;
        inviteMembers: () => void;
    };
}

const ActionBar = ({className, channelType, membersCount, canManageMembers, editing, actions}: Props) => {
    const showManageButton = channelType !== Constants.GM_CHANNEL && membersCount > 1;

    const handleShortcut = useCallback((e) => {
        if (isKeyPressed(e, Constants.KeyCodes.ESCAPE) && editing) {
            actions.stopEditing();
        }
    }, [editing, actions]);

    useEffect(() => {
        document.addEventListener('keydown', handleShortcut);
        return () => {
            document.removeEventListener('keydown', handleShortcut);
        };
    }, [handleShortcut]);

    return (
        <div className={className}>
            <Title>
                {editing ? (
                    <FormattedMessage
                        id='channel_members_rhs.action_bar.managing_title'
                        defaultMessage='Managing Members'
                    />
                ) : (
                    <FormattedMessage
                        id='channel_members_rhs.action_bar.members_count_title'
                        defaultMessage='{members_count} members'
                        values={{members_count: membersCount}}
                    />
                )}

            </Title>

            {canManageMembers && (
                <Actions>
                    {editing ? (
                        <Button
                            onClick={actions.stopEditing}
                            className='manage-members-done'
                        >
                            <FormattedMessage
                                id='channel_members_rhs.action_bar.done_button'
                                defaultMessage='Done'
                            />
                        </Button>
                    ) : (
                        <>
                            {showManageButton && (
                                <Button
                                    className='manage-members'
                                    onClick={actions.startEditing}
                                >
                                    <FormattedMessage
                                        id='channel_members_rhs.action_bar.manage_button'
                                        defaultMessage='Manage'
                                    />
                                </Button>
                            )}
                            <Button
                                onClick={actions.inviteMembers}
                                className='add-members'
                            >
                                <ButtonIcon
                                    className='icon-account-plus-outline'
                                    title='Add Icon'
                                />
                                <FormattedMessage
                                    id='channel_members_rhs.action_bar.add_button'
                                    defaultMessage='Add'
                                />
                            </Button>
                        </>
                    )}

                </Actions>
            )}
        </div>
    );
};

export default styled(ActionBar)`
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 16px 20px;
`;
