// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import Profile from 'src/components/profile/profile';

interface Props {
    userId?: string;
    enableEdit: boolean;
    withoutProfilePic?: boolean;
    profileButtonClass?: string;
    customDropdownArrow?: React.ReactNode;
    onClick: () => void;
}

export default function ProfileButton(props: Props) {
    const dropdownArrow = props.customDropdownArrow ? props.customDropdownArrow : (
        <i className='icon-chevron-down mr-2'/>
    );
    const downChevron = props.enableEdit ? dropdownArrow : null;

    const formatName = (preferredName: string, userName: string) => {
        let name = preferredName;
        if (preferredName === userName) {
            name = '@' + name;
        }
        return <span>{name}</span>;
    };

    return (
        <Button
            onClick={props.onClick}
            className={props.profileButtonClass || 'PlaybookRunProfileButton'}
        >
            <Profile
                userId={props.userId || ''}
                classNames={{active: props.enableEdit}}
                extra={downChevron}
                nameFormatter={formatName}
                withoutProfilePic={props.withoutProfilePic}
            />
        </Button>
    );
}

const Button = styled.button`
    height: 40px;
    padding: 0 4px 0 12px;
    border: none;
    border-radius: 4px;
    background-color: unset;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    cursor: default;
    font-weight: 600;
    transition: all 0.15s ease;
    transition-delay: 0s;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: rgba(var(--center-channel-color-rgb), 0.72);
    }

    &.active {
        cursor: pointer;
    }

    .PlaybookRunProfile {
        &.active {
            color: var(--center-channel-color);
            cursor: pointer;
        }
    }

    .NoAssignee-button, .Assigned-button {
        padding: 4px;
        border: none;
        border-radius: 100px;
        margin-top: 4px;
        background-color: transparent;
        color: rgba(var(--center-channel-color-rgb), 0.64);
        cursor: pointer;
        font-size: 12px;
        font-weight: normal;
        line-height: 16px;
        transition: all 0.15s ease;

        &:hover {
            background: rgba(var(--center-channel-color-rgb), 0.08);
            color: rgba(var(--center-channel-color-rgb), 0.72);
        }

        &.active {
            cursor: pointer;
        }

        .icon-chevron-down {
            &::before {
                margin: 0;
            }
        }
    }

    .first-container .Assigned-button {
        padding: 2px 0;
        margin-top: 0;
        color: var(--center-channel-color);
        font-size: 14px;
        line-height: 20px;
    }
`;
