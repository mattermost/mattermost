
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

const LoadingSpinner = (props: {className?: string}) => (
    <svg
        width='32'
        height='32'
        color='var(--button-bg)'
        viewBox='0 0 20 20'
        fill='none'
        className={props.className}
    >
        <g strokeWidth='2'>
            <path
                d='M10 1C14.9706 1 19 5.02944 19 10C19 14.2832 16.008 17.8675 12 18.777'
                stroke='url(#spinner-tail-gradient)'
            />
            <path
                d='M10 19C5.02944 19 1 14.9706 1 10C1 5.02944 5.02944 1 10 1'
                stroke='url(#spinner-head-gradient)'
            />
            <circle
                cx='10'
                cy='19'
                r='1'
            />
        </g>
        <defs>
            <linearGradient
                id='spinner-head-gradient'
                x1='10'
                y1='18'
                x2='10'
                y2='2'
                gradientUnits='userSpaceOnUse'
            >
                <stop stopColor='currentColor'/>
                <stop
                    offset='1'
                    stopColor='currentColor'
                    stopOpacity='.5'
                />
            </linearGradient>
            <linearGradient
                id='spinner-tail-gradient'
                x1='10'
                y1='2'
                x2='10'
                y2='18'
                gradientUnits='userSpaceOnUse'
            >
                <stop
                    stopColor='currentColor'
                    stopOpacity='.5'
                />
                <stop
                    offset='1'
                    stopColor='currentColor'
                    stopOpacity='0'
                />
            </linearGradient>
        </defs>

        <animateTransform
            from='0 0 0'
            to='360 0 0'
            attributeName='transform'
            type='rotate'
            repeatCount='indefinite'
            dur='600ms'
        />

    </svg>
);

export default LoadingSpinner;
