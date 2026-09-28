// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Sourced from @mattermost/compass-ui illustrations/slash-commands.svg

import React from 'react';

type Props = {
    className?: string;
};

const SlashCommandsSvg = ({className}: Props) => (
    <svg
        className={className}
        width='122'
        height='72'
        viewBox='0 0 122 72'
        fill='none'
        xmlns='http://www.w3.org/2000/svg'
        aria-hidden={true}
    >
        <circle cx='2' cy='2' r='2' transform='matrix(-2.3597e-08 -1 -1 2.3597e-08 121.233 16)' fill='var(--center-channel-color)' fillOpacity='0.32'/>
        <circle cx='2' cy='2' r='2' transform='matrix(-2.3597e-08 -1 -1 2.3597e-08 121.233 10)' fill='var(--center-channel-color)' fillOpacity='0.32'/>
        <circle cx='2' cy='2' r='2' transform='matrix(-2.3597e-08 -1 -1 2.3597e-08 121.232 4)' fill='var(--center-channel-color)' fillOpacity='0.32'/>
        <path d='M119.233 18.5V58.5H37.0332M29.7266 58.5H13.1133M7.80664 58.5H0.5' stroke='var(--center-channel-color)' strokeOpacity='0.32' strokeLinecap='round' strokeLinejoin='round'/>
        <rect x='14.998' y='12.9866' width='98' height='54.0002' rx='4' fill='var(--center-channel-color)' fillOpacity='0.08'/>
        <g opacity='0.7'>
        <path d='M86.9961 41.379L96.5384 41.379L96.5384 19.4866L105.996 19.4866' stroke='var(--center-channel-color)' strokeOpacity='0.32' strokeWidth='1.5' strokeLinecap='round'/>
        <path d='M10.2305 16.449L10.2305 23.949L35.1133 23.949L53.6509 42.4866' stroke='var(--center-channel-color)' strokeOpacity='0.32' strokeWidth='1.5' strokeLinecap='round'/>
        <ellipse cx='10.2273' cy='15.2178' rx='2.23125' ry='2.23125' fill='var(--center-channel-color)' fillOpacity='0.56'/>
        <ellipse cx='2.5' cy='2.5' rx='2.5' ry='2.5' transform='matrix(1 8.74228e-08 8.74228e-08 -1 105.996 21.9866)' fill='var(--center-channel-color)' fillOpacity='0.56'/>
        </g>
        <rect x='30.5339' y='17.2998' width='62.3565' height='53.7566' rx='6' fill='var(--center-channel-bg)'/>
        <rect x='31.0339' y='17.7998' width='61.3565' height='52.7566' rx='5.5' fill='var(--center-channel-color)' fillOpacity='0.24' stroke='var(--center-channel-color)'/>
        <rect x='31.0339' y='7.58374' width='61.3565' height='56.1692' rx='5.5' fill='var(--center-channel-bg)' stroke='var(--center-channel-color)'/>
        <rect x='33.5339' y='11.0837' width='58.3565' height='53.1692' rx='6' fill='var(--center-channel-color)' fillOpacity='0.08'/>
        <path d='M54.3866 50.6504L71.511 20.6861H67.038L49.9136 50.6504H54.3866Z' fill='var(--center-channel-color)'/>
    </svg>
);

export default SlashCommandsSvg;
