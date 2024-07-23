// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {SVGProps} from 'react';
import React from 'react';
import styled, {keyframes} from 'styled-components';

import denimBackground from './denim_background.png';

const Container = styled.div`
    width: 100%;
    height: 100%;
    background-image: url(${denimBackground});
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    background-color: #1e325c;
    display: flex;
    justify-content: center;
    align-items: center;
    text-align: center;
`;

const svgSpinAnimation = keyframes`
    from {
        transform: rotate(0deg);
    }
    to {
        transform: rotate(360deg);
    }
`;

const SpinningSvg = styled(SpinnerSvg)`
    animation: ${svgSpinAnimation} 0.5s linear infinite;
`;

export default function WelcomeLoader() {
    return (
        <Container>
            <SpinningSvg/>
        </Container>
    );
}

function SpinnerSvg(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            {...props}
            width='60'
            height='60'
            viewBox='0 0 60 60'
            fill='none'
            xmlns='http://www.w3.org/2000/svg'
        >
            <g id='.Base Shape'>
                <path
                    id='first half (Stroke)'
                    fillRule='evenodd'
                    clipRule='evenodd'
                    d='M54 30C54 43.2548 43.2548 54 30 54V60C46.5685 60 60 46.5685 60 30C60 15.719 50.0242 3.77506 36.6639 0.743431L35.3361 6.59468C46.0236 9.0198 54 18.582 54 30Z'
                    fill='url(#paint0_linear_4271_564)'
                />
                <path
                    id='second half (Stroke)'
                    fillRule='evenodd'
                    clipRule='evenodd'
                    d='M30 54C16.7452 54 6 43.2548 6 30C6 16.7452 16.7452 6 30 6V0C13.4315 0 0 13.4315 0 30C0 46.5685 13.4315 60 30 60V54Z'
                    fill='url(#paint1_linear_4271_564)'
                />
                <circle
                    id='Ellipse 40'
                    cx='3'
                    cy='3'
                    r='3'
                    transform='matrix(1 0 0 -1 27 6)'
                    fill='white'
                />
            </g>
            <defs>
                <linearGradient
                    id='paint0_linear_4271_564'
                    x1='30'
                    y1='54.1194'
                    x2='30'
                    y2='5.92021'
                    gradientUnits='userSpaceOnUse'
                >
                    <stop
                        stopColor='white'
                        stopOpacity='0.5'
                    />
                    <stop
                        offset='1'
                        stopColor='white'
                        stopOpacity='0'
                    />
                </linearGradient>
                <linearGradient
                    id='paint1_linear_4271_564'
                    x1='31.2614'
                    y1='6.20608'
                    x2='31.2614'
                    y2='54.011'
                    gradientUnits='userSpaceOnUse'
                >
                    <stop stopColor='white'/>
                    <stop
                        offset='1'
                        stopColor='white'
                        stopOpacity='0.5'
                    />
                </linearGradient>
            </defs>
        </svg>
    );
}
