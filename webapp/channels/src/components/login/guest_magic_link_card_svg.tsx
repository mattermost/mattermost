// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

const GuestMagicLinkCardSvg = () => {
    return (
        <svg
            width={184}
            height={160}
            fill='none'
            xmlns='http://www.w3.org/2000/svg'
        >
            <g clipPath='url(#a)'>
                <circle
                    cx={92}
                    cy={80}
                    r={80}
                    fill={'var(--center-channel-color)'}
                    fillOpacity={0.08}
                />
                <path
                    stroke={'var(--center-channel-color)'}
                    strokeLinecap='round'
                    strokeOpacity={0.32}
                    strokeWidth={1.345}
                    d='M2 66.8v12h154.4v12.8h22.8M32.4 109.6V88h21.2'
                />
                <circle
                    cx={2}
                    cy={2}
                    r={2}
                    fill={'var(--center-channel-color)'}
                    fillOpacity={0.56}
                    transform='matrix(1 0 0 -1 0 67.2)'
                />
                <circle
                    cx={2}
                    cy={2}
                    r={2}
                    fill={'var(--center-channel-color)'}
                    fillOpacity={0.56}
                    transform='matrix(1 0 0 -1 30.4 113.6)'
                />
                <circle
                    cx={2}
                    cy={2}
                    r={2}
                    fill={'var(--center-channel-color)'}
                    fillOpacity={0.56}
                    transform='matrix(1 0 0 -1 177.6 93.6)'
                />
                <path
                    fill={'var(--center-channel-bg)'}
                    stroke={'var(--center-channel-color)'}
                    strokeLinejoin='round'
                    strokeWidth={1.345}
                    d='M43.197 58.4 92.6 20.8c19.772 15.048 48.996 37.6 48.996 37.6V128h-98.4V58.4Z'
                />
                <path
                    fill={'var(--center-channel-color)'}
                    fillOpacity={0.24}
                    d='M138.662 124.8H46.137V59.355L92.592 24c18.591 14.15 46.07 35.355 46.07 35.355V124.8Z'
                />
                <mask
                    id='b'
                    width={95}
                    height={66}
                    x={45}
                    y={30}
                    maskUnits='userSpaceOnUse'
                    style={{
                        maskType: 'alpha',
                    }}
                >
                    <path
                        fill={'var(--center-channel-bg)'}
                        d='M92.594 95.2 45.6 60V30.4h93.6V60s-27.798 21.113-46.606 35.2Z'
                    />
                </mask>
                <g mask='url(#b)'>
                    <path
                        fill={'var(--center-channel-bg)'}
                        stroke={'var(--center-channel-color)'}
                        strokeWidth={1.345}
                        d='M123.328 34.272v89.055H61.473V34.272z'
                    />
                </g>
                <path
                    fill={'var(--online-indicator)'}
                    d='M92.8 79.637c7.511 0 13.6-6.089 13.6-13.6 0-7.511-6.089-13.6-13.6-13.6-7.511 0-13.6 6.089-13.6 13.6 0 7.511 6.089 13.6 13.6 13.6Z'
                />
                <path
                    stroke={'var(--center-channel-bg)'}
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={1.6}
                    d='m87.295 66.555 4.39 3.966 8.383-8.672'
                />
                <path
                    fill={'var(--center-channel-bg)'}
                    d='M92.593 95.154 140 59.2v68h-95.2v-68l47.794 35.954Z'
                />
                <path
                    stroke={'var(--center-channel-color)'}
                    strokeLinejoin='round'
                    strokeWidth={1.345}
                    d='m45.6 60 46.993 35.2C111.401 81.113 139.2 60 139.2 60'
                />
                <path
                    stroke={'var(--center-channel-color)'}
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={1.345}
                    d='M116.303 131.765H91.43M87.396 131.765h-8.067M75.295 131.765h-2.689'
                />
                <path
                    fill='#CCC4AE'
                    d='m39.849 40.174 7.21 7.196V12.511a1.6 1.6 0 0 0-1.6-1.6h-32.37a1.6 1.6 0 0 0-1.6 1.6v26.063a1.6 1.6 0 0 0 1.6 1.6h26.76Z'
                />
                <path
                    stroke='#3F4350'
                    strokeLinecap='round'
                    strokeWidth={1.345}
                    d='M20.38 19.804h10.67M20.38 24.25h19.563M20.38 29.585h8.002M30.16 29.585h8.004'
                />
                <path
                    fill='#28427B'
                    d='M141.159 45.263 130.401 56V3.2a1.6 1.6 0 0 1 1.6-1.6h49.873a1.6 1.6 0 0 1 1.6 1.6v40.463a1.6 1.6 0 0 1-1.6 1.6h-40.715Z'
                />
                <path
                    stroke='#fff'
                    strokeLinecap='round'
                    strokeWidth={1.345}
                    d='M143.67 14.868h15.922M143.67 21.502h29.19M143.67 29.464h11.941M158.265 29.464h11.941'
                />
                <rect
                    width={26.218}
                    height={6.05}
                    x={79.328}
                    y={40.336}
                    fill={'var(--center-channel-color)'}
                    fillOpacity={0.16}
                    rx={2.017}
                />
                <path
                    stroke={'var(--center-channel-color)'}
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeOpacity={0.32}
                    strokeWidth={1.345}
                    d='M47.731 69.244v53.781h30.252m2.69 0h5.377m2.69 0h2.689'
                />
            </g>
            <defs>
                <clipPath id='a'>
                    <path
                        fill={'var(--center-channel-bg)'}
                        d='M0 0h183.2v160H0z'
                    />
                </clipPath>
            </defs>
        </svg>
    );
};

export default GuestMagicLinkCardSvg;
