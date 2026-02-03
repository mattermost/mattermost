// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// https://www.figma.com/file/MYVj0NUudT9V7GV9KepBy3/%E2%9C%85Foundations---Illustrations?node-id=665%3A9992

import React from 'react';

type SvgProps = {
    width: number;
    height: number;
};

const UploadLicenseSvg = (props: SvgProps) => (
    <svg
        width={props.width ? props.width.toString() : '101'}
        height={props.height ? props.height.toString() : '69'}
        viewBox='0 0 101 69'
        fill='none'
        xmlns='http://www.w3.org/2000/svg'
    >
        <rect
            x='0.000976562'
            y='9'
            width='84'
            height='24'
            rx='3.75'
            fill='var(--button-bg)'
            fillOpacity='0.12'
        />
        <rect
            x='14.001'
            y='36'
            width='87'
            height='25'
            rx='3.75'
            fill='var(--button-bg)'
            fillOpacity='0.12'
        />
        <rect
            x='28.0286'
            y='9.33704'
            width='48.1218'
            height='58.8953'
            rx='2'
            fill='var(--indigo-400)'
        />
        <rect
            x='23.001'
            width='50.505'
            height='65.3594'
            rx='2'
            fill='var(--center-channel-bg)'
        />
        <rect
            x='23.501'
            y='0.5'
            width='49.505'
            height='64.3594'
            rx='1.5'
            stroke='var(--center-channel-color)'
            strokeOpacity='0.8'
        />
        <path
            d='M48.001 49C56.2853 49 63.001 42.2843 63.001 34C63.001 25.7157 56.2853 19 48.001 19C39.7167 19 33.001 25.7157 33.001 34C33.001 42.2843 39.7167 49 48.001 49Z'
            fill='var(--button-bg)'
        />
        <path
            d='M29 7H37.6188'
            stroke='var(--center-channel-color)'
            strokeOpacity='0.48'
            strokeLinecap='round'
        />
        <path
            d='M29 54H57.0112'
            stroke='var(--center-channel-color)'
            strokeOpacity='0.48'
            strokeLinecap='round'
        />
        <path
            d='M29 11H44.8012'
            stroke='var(--center-channel-color)'
            strokeOpacity='0.48'
            strokeLinecap='round'
        />
        <path
            d='M29 58H65.63'
            stroke='var(--center-channel-color)'
            strokeOpacity='0.48'
            strokeLinecap='round'
        />
        <path
            d='M38 15H44.4641'
            stroke='var(--center-channel-color)'
            strokeOpacity='0.48'
            strokeLinecap='round'
        />
        <path
            d='M49.0192 42H46.9828V29.8788L41.4313 35.4303L40.001 34L48.001 26L56.001 34L54.5707 35.4303L49.0192 29.8788V42Z'
            fill='white'
        />
    </svg>
);

export default UploadLicenseSvg;
