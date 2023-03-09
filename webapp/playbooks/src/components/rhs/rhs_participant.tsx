// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled, {css} from 'styled-components';
import {OverlayTrigger, Tooltip} from 'react-bootstrap';

import Profile from 'src/components/profile/profile';

import {OVERLAY_DELAY} from 'src/constants';

import {useFormattedUsernameByID} from 'src/hooks';

export const RHSParticipant = (props: UserPicProps) => {
    const name = useFormattedUsernameByID(props.userId);

    const tooltip = (
        <Tooltip id={'username-' + props.userId}>
            {name}
        </Tooltip>
    );

    return (
        <OverlayTrigger
            placement={'bottom'}
            delay={OVERLAY_DELAY}
            overlay={tooltip}
        >
            <UserPic sizeInPx={props.sizeInPx}>
                <Profile
                    userId={props.userId}
                    withoutName={true}
                />
            </UserPic>
        </OverlayTrigger>
    );
};

interface UserPicProps {
    userId: string;
    sizeInPx: number;
}

const leftHoleSvg = (sizeInPx: number) => `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" height="${sizeInPx}px" width="${sizeInPx}px"><path d="M 3.8043 4.4058 A 14 14 0 1 1 3.8043 23.5942 A 16 16 0 0 0 3.8043 4.4058 Z"/></svg>`;
const rightHoleSvg = (sizeInPx: number) => `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" height="${sizeInPx}px" width="${sizeInPx}px"><path d="M 24.1957 4.4058 A 14 14 0 1 0 24.1957 23.5942 A 16 16 0 0 1 24.1957 4.4058 Z"/></svg>`;
const bothHolesSvg = (sizeInPx: number) => `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" height="${sizeInPx}px" width="${sizeInPx}px"><path d="M 3.8043 4.4058 A 14 14 0 0 1 24.1957 4.4058 A 16 16 0 0 0 24.1957 23.5942 A 14 14 0 0 1 3.8043 23.5942 A 16 16 0 0 0 3.8043 4.4058 Z"/></svg>`;

const UserPic = styled.div<{sizeInPx: number}>`
    position: relative;

    .IncidentProfile {
        flex-direction: column;

        .name {
            display: none;
        }
    }

    && .image {
        margin: 0;
        ${({sizeInPx}) => css`
            width: ${sizeInPx}px;
            height: ${sizeInPx}px;
        `}
    }

    :not(:first-child) {
        margin-left: -${({sizeInPx}) => (sizeInPx * 5) / 28}px;
    }

    :not(:last-child):not(:hover) {
        mask-image: url('${({sizeInPx}) => rightHoleSvg(sizeInPx)}');
    }


    div:hover + &&&:not(:last-child) {
        mask-image: url('${({sizeInPx}) => bothHolesSvg(sizeInPx)}');
    }


    div:hover + &&&:last-child {
        mask-image: url('${({sizeInPx}) => leftHoleSvg(sizeInPx)}');
    }
`;

export const Rest = styled.div<{sizeInPx: number}>`
    ${({sizeInPx}) => css`
        width: ${sizeInPx}px;
        height: ${sizeInPx}px;
    `}
    margin-left: -${({sizeInPx}) => (sizeInPx * 5) / 28}px;
    border-radius: 50%;

    background-color: rgba(var(--center-channel-color-rgb), 0.16);
    color: rgba(var(--center-channel-color-rgb), 0.72);

    font-weight: 600;
    font-size: 11px;

    display: flex;
    align-items: center;
    justify-content: center;

    div:hover + &&& {
        mask-image: url('${({sizeInPx}) => leftHoleSvg(sizeInPx)}');
    }
`;
