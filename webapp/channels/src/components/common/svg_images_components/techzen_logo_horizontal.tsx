// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// Techzen: Horizontal logo SVG component (blue text + red globe icon)

import React from 'react';

type Props = {
    width?: number;
    height?: number;
    className?: string;
}

const TechzenLogoHorizontal = ({ width = 140, height = 35, className }: Props): JSX.Element => (
    <svg
        xmlns='http://www.w3.org/2000/svg'
        viewBox='0 0 480 120'
        width={width}
        height={height}
        className={className}
        aria-label='Techzen Chat'
    >
        {/* Planet/Globe Icon */}
        <g transform='translate(10, 10)'>
            {/* Outer red orbit ellipse */}
            <ellipse
                cx='50'
                cy='50'
                rx='48'
                ry='20'
                fill='none'
                stroke='#e63434'
                strokeWidth='8'
                strokeLinecap='round'
                transform='rotate(-25, 50, 50)'
                strokeDasharray='200 70'
            />
            {/* Globe circle */}
            <circle
                cx='50'
                cy='50'
                r='36'
                fill='white'
                stroke='#e63434'
                strokeWidth='6'
            />
            {/* Red horizontal stripes inside globe */}
            <rect
                x='30'
                y='36'
                width='28'
                height='6'
                rx='3'
                fill='#e63434'
                transform='rotate(-15, 44, 39)'
            />
            <rect
                x='28'
                y='46'
                width='32'
                height='6'
                rx='3'
                fill='#e63434'
                transform='rotate(-15, 44, 49)'
            />
            <rect
                x='30'
                y='56'
                width='28'
                height='6'
                rx='3'
                fill='#e63434'
                transform='rotate(-15, 44, 59)'
            />
            {/* Navy swoosh arrow */}
            <path
                d='M 72 62 Q 90 75 75 88 Q 65 95 50 90'
                fill='none'
                stroke='#137fec'
                strokeWidth='9'
                strokeLinecap='round'
            />
            {/* Arrow tip */}
            <polygon
                points='47,83 53,95 60,87'
                fill='#137fec'
            />
        </g>
        {/* TECHZEN text */}
        <text
            x='130'
            y='75'
            fontFamily='Arial Black, Arial, sans-serif'
            fontSize='56'
            fontWeight='900'
            fill='currentColor'
            letterSpacing='2'
        >
            {'TECHZEN'}
        </text>
    </svg>
);

export default TechzenLogoHorizontal;
