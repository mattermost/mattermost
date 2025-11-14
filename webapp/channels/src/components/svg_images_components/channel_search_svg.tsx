// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

export function ChannelSearchSVG(props: React.HTMLAttributes<HTMLSpanElement>) {
    const {formatMessage} = useIntl();
    return (
        <span {...props}>
            <svg
                width='128'
                height='101'
                viewBox='0 0 128 101'
                role='img'
                aria-label={formatMessage({id: 'generic_icons.channel_search', defaultMessage: 'Channel Search Icon'})}
            >
                <g clipPath='url(#clip0_4210_70026)'>
                    <path
                        opacity='0.4'
                        d='M110.046 91.1199L120.002 101V50C120.002 48.8954 119.107 48 118.002 48H70.002C68.8974 48 68.002 48.8954 68.002 50V88.5395C68.002 89.644 68.8974 90.5395 70.002 90.5395H108.637C109.165 90.5395 109.672 90.7481 110.046 91.1199Z'
                        fill='var(--center-channel-bg)'
                    />
                    <path
                        d='M110.046 91.1199L120.002 101V50C120.002 48.8954 119.107 48 118.002 48H70.002C68.8974 48 68.002 48.8954 68.002 50V88.5395C68.002 89.644 68.8974 90.5395 70.002 90.5395H108.637C109.165 90.5395 109.672 90.7481 110.046 91.1199Z'
                        fill='var(--button-bg)'
                        fillOpacity='0.12'
                    />
                    <path
                        d='M5.50196 18L5.50195 33L94.002 33'
                        stroke='var(--center-channel-color)'
                        strokeOpacity='0.32'
                        strokeLinecap='round'
                    />
                    <path
                        d='M3.00201 94L13.502 83.5L13.502 44.5L34.502 44.5'
                        stroke='var(--center-channel-color)'
                        strokeOpacity='0.32'
                        strokeLinecap='round'
                    />
                    <path
                        d='M21.502 70.5L21.502 56.5L95.5 56.5'
                        stroke='var(--center-channel-color)'
                        strokeOpacity='0.32'
                        strokeLinecap='round'
                    />
                    <circle
                        cx='2.5'
                        cy='2.5'
                        r='2.5'
                        transform='matrix(1 8.74228e-08 8.74228e-08 -1 3.00195 18)'
                        fill='var(--center-channel-color)'
                        fillOpacity='0.48'
                    />
                    <circle
                        cx='2.5'
                        cy='2.5'
                        r='2.5'
                        transform='matrix(1 8.74228e-08 8.74228e-08 -1 19.002 74)'
                        fill='var(--center-channel-color)'
                        fillOpacity='0.48'
                    />
                    <path
                        d='M47.6069 78.5638L34.002 92V23C34.002 21.8954 34.8974 21 36.002 21H102.002C103.107 21 104.002 21.8954 104.002 23V75.9868C104.002 77.0914 103.107 77.9868 102.002 77.9868H49.0123C48.4862 77.9868 47.9812 78.1941 47.6069 78.5638Z'
                        fill='#28427B'
                    />
                    <path
                        d='M42.6069 73.5638L29.002 87V18C29.002 16.8954 29.8974 16 31.002 16H97.002C98.1065 16 99.002 16.8954 99.002 18V70.9868C99.002 72.0914 98.1065 72.9868 97.002 72.9868H44.0123C43.4862 72.9868 42.9812 73.1941 42.6069 73.5638Z'
                        fill='var(--center-channel-bg)'
                    />
                    <path
                        d='M42.2556 73.2081L29.502 85.8035V18C29.502 17.1716 30.1735 16.5 31.002 16.5H97.002C97.8304 16.5 98.502 17.1716 98.502 18V70.9868C98.502 71.8153 97.8304 72.4868 97.002 72.4868H44.0123C43.3546 72.4868 42.7235 72.746 42.2556 73.2081Z'
                        stroke='var(--center-channel-color)'
                        strokeOpacity='0.8'
                    />
                    <circle
                        cx='47.002'
                        cy='35'
                        r='9'
                        fill='var(--center-channel-color)'
                        fillOpacity='0.32'
                    />
                    <path
                        d='M62.002 31H78.002'
                        stroke='var(--center-channel-color)'
                        strokeOpacity='0.48'
                        strokeLinecap='round'
                    />
                    <path
                        d='M39.002 55H72.002'
                        stroke='var(--center-channel-color)'
                        strokeOpacity='0.48'
                        strokeLinecap='round'
                    />
                    <path
                        d='M39.002 62H61.002'
                        stroke='var(--center-channel-color)'
                        strokeOpacity='0.48'
                        strokeLinecap='round'
                    />
                    <path
                        d='M62.002 37H87.002'
                        stroke='var(--center-channel-color)'
                        strokeOpacity='0.48'
                        strokeLinecap='round'
                    />
                    <path
                        d='M39.002 49H56.002'
                        stroke='var(--center-channel-color)'
                        strokeOpacity='0.48'
                        strokeLinecap='round'
                    />
                    <path
                        d='M60.002 49H78.002'
                        stroke='var(--center-channel-color)'
                        strokeOpacity='0.48'
                        strokeLinecap='round'
                    />
                    <circle
                        cx='17.8576'
                        cy='17.8576'
                        r='17.8576'
                        transform='matrix(-1 0 0 1 123.717 0)'
                        fill='var(--center-channel-bg)'
                    />
                    <circle
                        cx='17.8576'
                        cy='17.8576'
                        r='17.1433'
                        transform='matrix(-1 0 0 1 123.717 0)'
                        stroke='var(--center-channel-color)'
                        strokeOpacity='0.8'
                        strokeWidth='1.42861'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                    />
                    <circle
                        cx='17.8576'
                        cy='17.8576'
                        r='17.1433'
                        transform='matrix(-1 0 0 1 123.717 0)'
                        stroke='var(--center-channel-color)'
                        strokeOpacity='0.8'
                        strokeWidth='1.42861'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                    />
                    <path
                        d='M93.002 19C93.002 25.6274 98.3745 31 105.002 31'
                        stroke='var(--center-channel-color)'
                        strokeOpacity='0.48'
                        strokeWidth='1.42861'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                    />
                    <line
                        x1='0.714303'
                        y1='-0.714303'
                        x2='15.1722'
                        y2='-0.714303'
                        transform='matrix(0.707107 0.707107 0.707107 -0.707107 116.769 30.6265)'
                        stroke='var(--center-channel-color)'
                        strokeOpacity='0.8'
                        strokeWidth='1.42861'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                    />
                    <path
                        d='M127.002 44.5V62H89.502'
                        stroke='var(--center-channel-color)'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                    />
                    <path
                        d='M86.002 62H76.002'
                        stroke='var(--center-channel-color)'
                        strokeLinecap='round'
                    />
                    <path
                        d='M73.002 62H67.002'
                        stroke='var(--center-channel-color)'
                        strokeLinecap='round'
                    />
                    <circle
                        cx='2.50195'
                        cy='94.5'
                        r='2.5'
                        fill='var(--center-channel-color)'
                        fillOpacity='0.48'
                    />
                </g>
                <defs>
                    <clipPath id='clip0_4210_70026'>
                        <rect
                            width='128'
                            height='101'
                            fill='white'
                            transform='translate(0.00195312)'
                        />
                    </clipPath>
                </defs>
            </svg>
        </span>
    );
}
