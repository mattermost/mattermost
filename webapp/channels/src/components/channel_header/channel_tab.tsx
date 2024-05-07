// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useDispatch} from 'react-redux';
import styled, {css} from 'styled-components';

import {ChannelTypes} from 'mattermost-redux/action_types';

interface Props {
    id: string;
    text: React.ReactNode;
    icon?: React.ReactNode;
    active?: boolean;
}

const Tab = styled.div<{active?: boolean}>`
    position: relative;
    padding: 4px 0;
    cursor: pointer;

    + .channel-tab {
        margin-left: 4px;
    }

    ${(props) => props.active && css`
        border-bottom: 2px solid var(--sidebar-text-active-border);
        color: var(--sidebar-text-active-border);
    `}
`;

const Title = styled.span<{active?: boolean}>`
    line-height: 12px;
    font-size: 12px;
    padding: 0 8px;
`;

const ChannelTab = ({id, text, active}: Props) => {
    const dispatch = useDispatch();

    const selectTab = useCallback(() => {
        dispatch({type: ChannelTypes.SELECT_CHANNEL_TAB, data: id});
    }, [dispatch, id]);

    return (
        <Tab
            className='channel-tab'
            active={active}
            onClick={selectTab}
        >
            <Title>{text}</Title>
        </Tab>
    );
};

export default ChannelTab;
