// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import Profile from 'src/components/profile/profile';

interface Props {
    userId?: string;
    enableEdit: boolean;
    withoutProfilePic?: boolean;
    withoutName?: boolean;
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
                withoutName={props.withoutName}
            />
        </Button>
    );
}

const Button = styled.button`
    font-weight: 600;
    height: 40px;
    padding: 0 4px 0 12px;
    border-radius: 4px;
    color: rgba(var(--center-channel-color-rgb), 0.56);

    -webkit-transition: all 0.15s ease;
    -webkit-transition-delay: 0s;
    -moz-transition: all 0.15s ease;
    -o-transition: all 0.15s ease;
    transition: all 0.15s ease;

    border: none;
    background-color: unset;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: rgba(var(--center-channel-color-rgb), 0.72);
    }

    cursor: default;
    &.active {
        cursor: pointer;
    }

    .PlaybookRunProfile {
        &.active {
            cursor: pointer;
            color: var(--center-channel-color);
        }
    }

    .NoAssignee-button, .Assigned-button {
        background-color: transparent;
        border: none;
        padding: 4px;
        margin-top: 4px;
        border-radius: 100px;
        color: rgba(var(--center-channel-color-rgb), 0.64);
        cursor: pointer;
        font-weight: normal;
        font-size: 12px;
        line-height: 16px;

        -webkit-transition: all 0.15s ease;
        -moz-transition: all 0.15s ease;
        -o-transition: all 0.15s ease;
        transition: all 0.15s ease;

        &:hover {
            background: rgba(var(--center-channel-color-rgb), 0.08);
            color: rgba(var(--center-channel-color-rgb), 0.72);
        }

        &.active {
            cursor: pointer;
        }

        .icon-chevron-down {
            &:before {
                margin: 0;
            }
        }
    }

    .first-container .Assigned-button {
        margin-top: 0;
        padding: 2px 0;
        font-size: 14px;
        line-height: 20px;
        color: var(--center-channel-color);
    }
`;
