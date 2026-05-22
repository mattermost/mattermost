// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

type SvgProps = {
    width?: number;
    height?: number;
}

const DataSpillageSVG = (props: SvgProps) => (
    <svg
        width={props.width ? props.width.toString() : '294'}
        height={props.height ? props.height.toString() : '180'}
        viewBox='0 0 294 180'
        fill='none'
        xmlns='http://www.w3.org/2000/svg'
    >
        <rect
            x='198'
            y='127'
            width='78'
            height='38'
            rx='4'
            fill='var(--center-channel-color)'
            fillOpacity='0.16'
        />
        <rect
            x='12'
            y='73'
            width='73'
            height='62'
            rx='4'
            fill='var(--center-channel-color)'
            fillOpacity='0.16'
        />
        <path
            d='M6 45V59H108'
            stroke='var(--center-channel-color)'
            strokeOpacity='0.32'
            strokeWidth='2'
            strokeLinecap='round'
        />
        <circle
            cx='6'
            cy='43'
            r='4'
            fill='var(--center-channel-color)'
            fillOpacity='0.48'
        />
        <path
            d='M281 147V107H242'
            stroke='var(--center-channel-color)'
            strokeOpacity='0.32'
            strokeWidth='2'
            strokeLinecap='round'
        />
        <circle
            cx='281'
            cy='151'
            r='4'
            fill='var(--center-channel-color)'
            fillOpacity='0.48'
        />
        <rect
            x='48'
            y='32'
            width='183'
            height='118'
            rx='8'
            fill='var(--center-channel-bg)'
            stroke='var(--center-channel-color)'
            strokeWidth='7'
        />
        <rect
            x='58'
            y='42'
            width='58'
            height='98'
            fill='var(--indigo-400)'
            fillOpacity='0.16'
        />
        <path
            d='M80 54H103'
            stroke='var(--center-channel-color)'
            strokeOpacity='0.32'
            strokeWidth='2'
            strokeLinecap='round'
        />
        <path
            d='M80 61H96'
            stroke='var(--center-channel-color)'
            strokeOpacity='0.32'
            strokeWidth='2'
            strokeLinecap='round'
        />
        <circle
            cx='70'
            cy='58'
            r='6'
            fill='var(--center-channel-color)'
            fillOpacity='0.32'
        />
        {[
            78,
            96,
            114,
            132,
        ].map((y) => (
            <React.Fragment key={y}>
                <circle
                    cx='70'
                    cy={y}
                    r='3'
                    fill='var(--center-channel-color)'
                    fillOpacity='0.32'
                />
                <path
                    d={`M80 ${y}H107`}
                    stroke='var(--center-channel-color)'
                    strokeOpacity='0.32'
                    strokeWidth='2'
                    strokeLinecap='round'
                />
            </React.Fragment>
        ))}
        {[
            70,
            92,
            114,
        ].map((y) => (
            <React.Fragment key={y}>
                <circle
                    cx='139'
                    cy={y}
                    r='7'
                    fill='var(--center-channel-color)'
                    fillOpacity='0.24'
                />
                <path
                    d={`M154 ${y - 5}H211`}
                    stroke='var(--center-channel-color)'
                    strokeOpacity='0.32'
                    strokeWidth='2'
                    strokeLinecap='round'
                />
                <path
                    d={`M154 ${y + 3}H201`}
                    stroke='var(--center-channel-color)'
                    strokeOpacity='0.32'
                    strokeWidth='2'
                    strokeLinecap='round'
                />
            </React.Fragment>
        ))}
        <path
            d='M232.7 22.6C235.1 18.5 241.1 18.5 243.5 22.6L276.6 80C279 84.1 276 89.3 271.2 89.3H205C200.2 89.3 197.2 84.1 199.6 80L232.7 22.6Z'
            fill='#FFBC1F'
            stroke='var(--center-channel-color)'
            strokeWidth='3'
            strokeLinejoin='round'
        />
        <path
            d='M238 39V61'
            stroke='var(--center-channel-color)'
            strokeWidth='6'
            strokeLinecap='round'
        />
        <circle
            cx='238'
            cy='74'
            r='4'
            fill='var(--center-channel-color)'
        />
    </svg>
);

export default DataSpillageSVG;
