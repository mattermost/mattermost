// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ReactNode} from 'react';
import styled from 'styled-components';

import ClearIcon from 'src/components/assets/icons/clear_icon';

interface Props {
    text: ReactNode;
    onClose: () => void;
}

const Pill = (props: Props) => (
    <PillBox>
        {props.text}
        <CloseIcon onClick={props.onClose}/>
    </PillBox>
);

export const PillBox = styled.div`
    display: inline-block;
    padding: 4px 4px 4px 12px;
    border-radius: 16px;
    background-color: rgba(var(--center-channel-color-rgb), 0.08);
    color: var(--center-channel-color);
    font-size: 14px;
    font-weight: normal;
    line-height: 15px;
`;

const CloseIcon = styled(ClearIcon)`
    width: auto;
    height: 18px;
    margin-left: 7px;
    color: rgba(var(--center-channel-color-rgb), 0.32);

    &:hover {
        cursor: pointer;
    }

    &:active {
        color: var(--center-channel-color)
    }
`;

export default Pill;
