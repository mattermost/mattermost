// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import {RHSParticipant, Rest} from 'src/components/rhs/rhs_participant';

interface Props {
    userIds: string[];
    maxUsers?: number;
}

const Following = (props: Props) => {
    if (props.userIds.length === 0) {
        return null;
    }

    const maxUsers = props.maxUsers ?? 5;

    return (
        <>
            <UserRow
                tabIndex={0}
            >
                {props.userIds.slice(0, maxUsers).map((userId: string) => (
                    <RHSParticipant
                        key={userId}
                        userId={userId}
                        sizeInPx={20}
                    />
                ))}
                {props.userIds.length > maxUsers &&
                    // eslint-disable-next-line formatjs/no-literal-string-in-jsx
                    <Rest sizeInPx={20}>{'+' + (props.userIds.length - maxUsers)}</Rest>
                }
            </UserRow>
        </>
    );
};

const UserRow = styled.div`
    width: max-content;
    padding: 0;
    display: flex;
    flex-direction: row;

    border-radius: 44px;
    margin-left: 12px;

    :hover {
        border-color: rgba(var(--center-channel-color-rgb), 0.08);
        background-color: rgba(var(--center-channel-color-rgb), 0.08);
        background-clip: padding-box;
    }
`;

export default Following;
