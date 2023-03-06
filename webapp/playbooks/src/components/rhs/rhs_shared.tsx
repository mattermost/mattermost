// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

export const RHSContainer = styled.div`
    height: calc(100vh - 119px);
    display: flex;
    flex-direction: column;
    position: relative;
`;

export const RHSContent = styled.div`
    flex: 1 1 auto;
    position: relative;
`;

export function renderView(props: any): JSX.Element {
    return (
        <div
            {...props}
            className='scrollbar--view'
        />);
}

export function renderThumbHorizontal(props: any): JSX.Element {
    return (
        <div
            {...props}
            className='scrollbar--horizontal'
        />);
}

export function renderThumbVertical(props: any): JSX.Element {
    return (
        <div
            {...props}
            className='scrollbar--vertical'
        />);
}

export function renderTrackHorizontal(props: any): JSX.Element {
    return (
        <div
            {...props}
            style={{display: 'none'}}
            className='track-horizontal'
        />);
}

export const HoverMenu = styled.div`
    display: flex;
    padding: 4px;
    position: absolute;
    right: 0;
    top: -8px;
    box-shadow: 0 2px 3px 0 rgba(0, 0, 0, 0.08);
    background-color: var(--center-channel-bg);
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 4px;
`;

export const HoverMenuButton = styled.i<{disabled?: boolean}>`
    display: inline-block;
    cursor: pointer;
    width: 28px;
    height: 28px;
    padding: 1px 0 0 1px;

    &:hover {
        color: ${(props) => (props.disabled ? 'rgba(var(--center-channel-color-rgb), 0.32)' : 'rgba(var(--center-channel-color-rgb), 0.56)')};
        background-color: ${(props) => (props.disabled ? 'transparent' : 'rgba(var(--center-channel-color-rgb), 0.08)')};
    }

    color: ${(props) => (props.disabled ? 'rgba(var(--center-channel-color-rgb), 0.32)' : 'rgba(var(--center-channel-color-rgb), 0.56)')};
`;

export const ChecklistHoverMenuButton = styled(HoverMenuButton)`
    width: 24px;
    height: 24px;
`;

export const UpdateBody = styled.div`
    padding-right: 6px;
`;

