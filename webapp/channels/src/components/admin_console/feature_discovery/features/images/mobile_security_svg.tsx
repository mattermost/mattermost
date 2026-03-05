// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

type SvgProps = {
    width?: number;
    height?: number;
}

const MobileSecuritySVG = (props: SvgProps) => (
    <svg
        width={props.width ? props.width.toString() : '198'}
        height={props.height ? props.height.toString() : '120'}
        viewBox='0 0 198 120'
        fill='none'
        xmlns='http://www.w3.org/2000/svg'
    >
        <g>
            <path
                d='M7 28L12.5 33.5V72.5H177.5V101.5'
                stroke='var(--center-channel-color)'
                strokeOpacity='0.24'
                strokeLinecap='round'
            />
            <ellipse
                cx='97.5'
                cy='60.5'
                rx='59.5'
                ry='59.5'
                fill='var(--button-bg)'
                fillOpacity='0.08'
            />
            <path
                d='M51 41L51 49.7097L143.46 49.7097L143.46 59L158 59'
                stroke='var(--center-channel-color)'
                strokeOpacity='0.24'
                strokeLinecap='round'
            />
            <path
                d='M131 100L131 85L116 85'
                stroke='var(--center-channel-color)'
                strokeOpacity='0.24'
                strokeLinecap='round'
            />
            <path
                d='M52.5 40.5C52.5 39.6716 51.8284 39 51 39C50.1716 39 49.5 39.6716 49.5 40.5C49.5 41.3284 50.1716 42 51 42C51.8284 42 52.5 41.3284 52.5 40.5Z'
                fill='var(--center-channel-color)'
                fillOpacity='0.48'
            />
            <ellipse
                cx='131'
                cy='101.5'
                rx='1.5'
                ry='1.5'
                transform='rotate(180 131 101.5)'
                fill='var(--center-channel-color)'
                fillOpacity='0.48'
            />
            <ellipse
                cx='1.5'
                cy='1.5'
                rx='1.5'
                ry='1.5'
                transform='matrix(1 8.74228e-08 8.74228e-08 -1 157 70)'
                fill='var(--center-channel-color)'
                fillOpacity='0.48'
            />
            <path
                d='M97.8223 14.6328C111.365 27.158 124.258 31.6982 136.875 31.6982H136.927L136.978 31.709L137.103 31.7344L137.532 31.8252L137.498 32.2627C135.141 62.6049 129.208 89.9348 102.737 104.651L97.7256 107.438L97.4814 107.572L97.2383 107.437L92.0625 104.543C65.818 89.8755 59.9876 62.795 57.502 32.6943L57.4639 32.2324L57.9219 32.1592L59.8447 31.8545L59.8662 31.8516L59.8877 31.8496C68.6477 31.2264 75.1136 30.1683 80.8018 27.6602C86.4813 25.1558 91.4272 21.1874 97.1055 14.6719L97.4434 14.2832L97.8223 14.6328Z'
                fill='var(--center-channel-bg)'
                stroke='#3F4350'
            />
            <path
                d='M97.485 99L93.0951 96.6096C71.045 84.6062 66.1078 62.4456 64 37.5833L65.6312 37.3316C80.5165 36.3001 87.8039 33.8204 97.485 23C109.04 33.4089 120.074 37.207 130.894 37.207L131 37.2287C129.001 62.2886 123.977 84.6549 101.736 96.6989L97.485 99Z'
                fill='var(--center-channel-color)'
                fillOpacity='0.12'
            />
            <path
                d='M72.5632 51.6124H116.686'
                stroke='var(--center-channel-color)'
                strokeOpacity='0.12'
                strokeLinecap='round'
            />
            <path
                d='M79.1345 57.2451H123.257'
                stroke='var(--center-channel-color)'
                strokeOpacity='0.12'
                strokeLinecap='round'
            />
            <path
                d='M74.4407 63.8165H118.563'
                stroke='var(--center-channel-color)'
                strokeOpacity='0.12'
                strokeLinecap='round'
            />
            <path
                d='M82.8896 75.0818H103.543'
                stroke='var(--center-channel-color)'
                strokeOpacity='0.12'
                strokeLinecap='round'
            />
            <path
                d='M68.8076 46.1042H82.8893'
                stroke='var(--center-channel-color)'
                strokeOpacity='0.12'
                strokeLinecap='round'
            />
            <path
                d='M85.7056 46.1042H106.359'
                stroke='var(--center-channel-color)'
                strokeOpacity='0.12'
                strokeLinecap='round'
            />
            <path
                d='M109.175 46.1042H127.012'
                stroke='var(--center-channel-color)'
                strokeOpacity='0.12'
                strokeLinecap='round'
            />
            <path
                d='M96.0327 80.7149H113.869'
                stroke='var(--center-channel-color)'
                strokeOpacity='0.12'
                strokeLinecap='round'
            />
            <path
                d='M82.8899 80.7149H93.2164'
                stroke='var(--center-channel-color)'
                strokeOpacity='0.12'
                strokeLinecap='round'
            />
            <path
                d='M76.3184 69.1778H96.9714'
                stroke='var(--center-channel-color)'
                strokeOpacity='0.12'
                strokeLinecap='round'
            />
            <path
                d='M99.7876 69.1777H117.624'
                stroke='var(--center-channel-color)'
                strokeOpacity='0.12'
                strokeLinecap='round'
            />
            <path
                d='M72.563 40.8164H96.0324'
                stroke='var(--center-channel-color)'
                strokeOpacity='0.12'
                strokeLinecap='round'
            />
            <path
                d='M99.7876 40.8164H123.257'
                stroke='var(--center-channel-color)'
                strokeOpacity='0.12'
                strokeLinecap='round'
            />
            <path
                fillRule='evenodd'
                clipRule='evenodd'
                d='M87.0013 57.3883H108.118C109.095 57.3883 109.885 58.1742 109.885 59.1484V66.9186C109.885 73.5528 106.909 78.9321 100.259 78.9321H94.8606C88.2109 78.9321 85.2349 73.5528 85.2349 66.9186V59.1484C85.2349 58.1775 86.0273 57.3883 87.0013 57.3883ZM97.1724 61.9248H96.2348V64.127V68.0017L97.478 69.2449L96.2348 70.4881V72.1297H99.6365V65.3642L98.6858 64.4136L99.6365 63.4629V61.9248H97.1724Z'
                fill='var(--button-bg)'
            />
            <path
                fillRule='evenodd'
                clipRule='evenodd'
                d='M103.374 54.1074V57.4273C103.374 57.4476 103.375 57.4675 103.376 57.4871H106.35C106.352 57.4675 106.352 57.4476 106.352 57.4273V54.1074C106.352 49.1351 103.096 45.0882 98.3075 45.0882H96.2798C91.4909 45.0882 88.2349 49.1351 88.2349 54.1074V57.4273C88.2349 57.4476 88.2356 57.4675 88.2371 57.4871H91.205C91.2066 57.4675 91.2073 57.4476 91.2073 57.4273V54.1074C91.2073 50.7242 93.3244 48.1476 95.8353 48.1476H98.7461C101.424 48.1476 103.374 50.7242 103.374 54.1074Z'
                fill='var(--button-bg)'
            />
        </g>
        <rect
            x='1.5'
            y='20.5'
            width='43'
            height='81'
            rx='7.5'
            fill='var(--center-channel-bg)'
            stroke='var(--center-channel-color)'
            strokeWidth='3'
        />
        <path
            d='M3 27.5C3 24.4624 5.46243 22 8.5 22H37.5C40.5376 22 43 24.4624 43 27.5V29H3V27.5Z'
            fill='var(--button-bg)'
            fillOpacity='0.16'
        />
        <circle
            cx='12.831'
            cy='64.831'
            r='5.83099'
            fill='var(--center-channel-color)'
            fillOpacity='0.56'
        />
        <path
            d='M9.69995 64.7411L12.0947 67.1786L16.2 63'
            stroke='var(--center-channel-bg)'
            strokeWidth='0.5525'
            strokeLinecap='round'
            strokeLinejoin='round'
        />
        <path
            d='M22.5488 63H32.915'
            stroke='var(--center-channel-color)'
            strokeOpacity='0.48'
            strokeLinecap='round'
        />
        <path
            d='M8 74H34'
            stroke='var(--center-channel-color)'
            strokeOpacity='0.48'
            strokeLinecap='round'
        />
        <path
            d='M8 82H28'
            stroke='var(--center-channel-color)'
            strokeOpacity='0.48'
            strokeLinecap='round'
        />
        <path
            d='M22.5488 67H38.746'
            stroke='var(--center-channel-color)'
            strokeOpacity='0.48'
            strokeLinecap='round'
        />
        <path
            d='M8 78H24'
            stroke='var(--center-channel-color)'
            strokeOpacity='0.48'
            strokeLinecap='round'
        />
        <path
            d='M27 78L39 78'
            stroke='var(--center-channel-color)'
            strokeOpacity='0.48'
            strokeLinecap='round'
        />
        <rect
            x='15'
            y='25'
            width='16'
            height='1'
            rx='0.5'
            fill='var(--center-channel-color)'
        />
        <rect
            opacity='0.16'
            x='148'
            y='24.9268'
            width='47.8049'
            height='77.0732'
            rx='4'
            fill='#090A0B'
        />
        <rect
            x='150.451'
            y='22.5'
            width='45.8049'
            height='78.0488'
            rx='3.5'
            fill='var(--center-channel-bg)'
            stroke='var(--center-channel-color)'
        />
        <path
            d='M171 87.9032H191'
            stroke='var(--center-channel-color)'
            strokeOpacity='0.56'
            strokeLinecap='round'
        />
        <path
            d='M181 92.9032H191'
            stroke='var(--center-channel-color)'
            strokeOpacity='0.56'
            strokeLinecap='round'
        />
        <path
            d='M175.317 38.8117H190.927'
            stroke='var(--center-channel-color)'
            strokeOpacity='0.56'
            strokeLinecap='round'
        />
        <path
            d='M156.805 47.5922H190.902'
            stroke='var(--center-channel-color)'
            strokeOpacity='0.56'
            strokeLinecap='round'
        />
        <path
            d='M156.805 53.4459H190.902'
            stroke='var(--center-channel-color)'
            strokeOpacity='0.56'
            strokeLinecap='round'
        />
        <path
            d='M175.317 32.9581H184.717'
            stroke='var(--center-channel-color)'
            strokeOpacity='0.56'
            strokeLinecap='round'
        />
        <path
            d='M186.958 32.9581H189.899'
            stroke='var(--center-channel-color)'
            strokeOpacity='0.56'
            strokeLinecap='round'
        />
        <path
            d='M163.302 29.5986C163.895 29.7336 164.45 29.968 164.95 30.2832L166.259 29.3242L167.631 30.6973L166.661 32.0186C166.963 32.5137 167.185 33.0623 167.312 33.6465L168.956 33.8994V35.8408L167.27 36.0996C167.129 36.6524 166.901 37.1694 166.602 37.6377L167.631 39.04L166.258 40.4121L164.823 39.3604C164.365 39.6314 163.864 39.8356 163.332 39.96L163.058 41.7383H161.117L160.841 39.9453C160.317 39.8163 159.824 39.611 159.375 39.3398L157.913 40.4121L156.541 39.0391L157.601 37.5908C157.319 37.1376 157.103 36.6392 156.967 36.1084L155.217 35.8398V33.8984L156.926 33.6348C157.049 33.0737 157.26 32.5456 157.546 32.0664L156.542 30.6973L157.915 29.3242L159.252 30.3037C159.741 29.9902 160.284 29.7546 160.865 29.6143L161.114 28H163.055L163.302 29.5986ZM162.117 32.1963C160.688 32.1964 159.53 33.3545 159.53 34.7832C159.53 36.2117 160.688 37.37 162.117 37.3701C163.546 37.3701 164.704 36.2118 164.704 34.7832C164.704 33.3545 163.546 32.1963 162.117 32.1963Z'
            fill='var(--center-channel-color)'
            fillOpacity='0.56'
        />
    </svg>
);

export default MobileSecuritySVG;
