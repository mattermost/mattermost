// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

type SvgProps = {
    width: number;
    height: number;
};

const SetupSystemSvg = (props: SvgProps) => (
    <svg
        width={props.width ? props.width.toString() : '197'}
        height={props.height ? props.height.toString() : '120'}
        viewBox='0 0 197 120'
        fill='none'
        xmlns='http://www.w3.org/2000/svg'
    >
        <rect
            x='6'
            y='22'
            width='181'
            height='78'
            rx='5.625'
            fill='var(--button-bg)'
            fillOpacity='0.12'
        />
        <path
            d='M14.255 11L19.755 16.5V70.5H40.755'
            stroke='var(--center-channel-color)'
            strokeOpacity='0.24'
            strokeLinecap='round'
        />
        <circle
            cx='2.5'
            cy='2.5'
            r='2.5'
            transform='matrix(1 0 0 -1 10.255 12)'
            fill='var(--center-channel-color)'
            fillOpacity='0.48'
        />
        <path
            d='M7.255 35L12.755 40.5V79.5H177.755V108.5'
            stroke='var(--center-channel-color)'
            strokeOpacity='0.24'
            strokeLinecap='round'
        />
        <circle
            cx='2.5'
            cy='2.5'
            r='2.5'
            transform='matrix(1 0 0 -1 175.255 112)'
            fill='var(--center-channel-color)'
            fillOpacity='0.48'
        />
        <circle
            cx='2.5'
            cy='2.5'
            r='2.5'
            transform='matrix(1 0 0 -1 3.255 36)'
            fill='var(--center-channel-color)'
            fillOpacity='0.48'
        />
        <path
            opacity='0.32'
            d='M62.1304 22H129.87L134 115H58L62.1304 22Z'
            fill='#BABEC9'
        />
        <rect
            opacity='0.32'
            width='92'
            height='5'
            transform='matrix(1 0 0 -1 50 120)'
            fill='var(--center-channel-color)'
        />
        <rect
            x='30'
            y='16'
            width='131'
            height='86'
            rx='4'
            fill='var(--center-channel-bg)'
            stroke='var(--center-channel-color)'
            strokeWidth='4'
        />
        <path
            d='M60.2804 44.2423C64.7656 44.2423 68.4016 40.6063 68.4016 36.1211C68.4016 31.636 64.7656 28 60.2804 28C55.7953 28 52.1593 31.636 52.1593 36.1211C52.1593 40.6063 55.7953 44.2423 60.2804 44.2423Z'
            fill='var(--online-indicator)'
        />
        <path
            d='M56.4581 35.723L59.2741 38.5097L64.1015 33.7325'
            stroke='var(--center-channel-bg)'
            strokeWidth='1.19'
            strokeLinecap='round'
            strokeLinejoin='round'
        />
        <path
            d='M72.3077 32.4158H94.7884'
            stroke='#1B1D22'
            strokeLinecap='round'
        />
        <path
            d='M97.1984 32.4158H106.833'
            stroke='#1B1D22'
            strokeLinecap='round'
        />
        <path
            d='M109.239 32.4158H113.254'
            stroke='#1B1D22'
            strokeLinecap='round'
        />
        <path
            opacity='0.5'
            d='M123.242 35.226H72.3077V41.3016H123.242V35.226Z'
            fill='#BABEC9'
        />
        <path
            d='M60.2804 67.5113C64.7656 67.5113 68.4016 63.8753 68.4016 59.3902C68.4016 54.905 64.7656 51.269 60.2804 51.269C55.7953 51.269 52.1593 54.905 52.1593 59.3902C52.1593 63.8753 55.7953 67.5113 60.2804 67.5113Z'
            fill='var(--online-indicator)'
        />
        <path
            d='M56.4581 58.9921L59.2741 61.7787L64.1015 57.0016'
            stroke='var(--center-channel-bg)'
            strokeWidth='1.19'
            strokeLinecap='round'
            strokeLinejoin='round'
        />
        <path
            d='M72.3077 55.6848H94.7884'
            stroke='#1B1D22'
            strokeLinecap='round'
        />
        <path
            d='M97.1984 55.6848H106.833'
            stroke='#1B1D22'
            strokeLinecap='round'
        />
        <path
            d='M109.239 55.6848H113.254'
            stroke='#1B1D22'
            strokeLinecap='round'
        />
        <path
            opacity='0.5'
            d='M139.242 58.495H72.3077V64.5706H139.242V58.495Z'
            fill='#BABEC9'
        />
        <rect
            x='110.255'
            width='83'
            height='50'
            rx='4'
            fill='var(--indigo-400)'
        />
        <path
            d='M152.255 10H166.736'
            stroke='var(--neutral-0)'
            strokeOpacity='0.48'
            strokeLinecap='round'
        />
        <path
            d='M152.255 16H175.255'
            stroke='var(--neutral-0)'
            strokeOpacity='0.48'
            strokeLinecap='round'
        />
        <path
            d='M152.255 22H182.255'
            stroke='var(--neutral-0)'
            strokeOpacity='0.48'
            strokeLinecap='round'
        />
        <path
            d='M152.255 28H182.255'
            stroke='var(--neutral-0)'
            strokeOpacity='0.48'
            strokeLinecap='round'
        />
        <path
            d='M169.146 10H178.78'
            stroke='var(--neutral-0)'
            strokeOpacity='0.48'
            strokeLinecap='round'
        />
        <path
            d='M181.187 10H184.201'
            stroke='var(--neutral-0)'
            strokeOpacity='0.48'
            strokeLinecap='round'
        />
        <path
            fillRule='evenodd'
            clipRule='evenodd'
            d='M127.764 6.9187H130.755L131.134 9.38061C132.05 9.58876 132.907 9.95029 133.678 10.4368L135.69 8.96111L137.805 11.0762L136.312 13.1123C136.776 13.8746 137.12 14.7186 137.316 15.6178L139.847 16.0072V18.9983L137.251 19.3976C137.034 20.2503 136.683 21.0495 136.223 21.7718L137.805 23.9292L135.69 26.0442L133.481 24.4246C132.776 24.8427 132.002 25.158 131.181 25.3498L130.76 28.0866H127.768L127.344 25.3268C126.537 25.1281 125.778 24.81 125.085 24.3922L122.832 26.0441L120.717 23.9291L122.352 21.6996C121.916 21.0008 121.583 20.2316 121.373 19.413L118.677 18.9982V16.0071L121.308 15.6023C121.498 14.7371 121.825 13.9232 122.265 13.1843L120.719 11.0762L122.834 8.96117L124.891 10.4695C125.646 9.98536 126.485 9.62157 127.381 9.40523L127.764 6.9187ZM133.296 17.3707C133.296 19.5721 131.511 21.3568 129.31 21.3568C127.108 21.3568 125.323 19.5721 125.323 17.3707C125.323 15.1692 127.108 13.3846 129.31 13.3846C131.511 13.3846 133.296 15.1692 133.296 17.3707Z'
            fill='var(--neutral-0)'
            fillOpacity='0.40'
        />
        <path
            fillRule='evenodd'
            clipRule='evenodd'
            d='M138.66 30.9484H140.293L140.5 32.292C140.999 32.4055 141.467 32.6027 141.888 32.868L142.985 32.0631L144.14 33.2176L143.326 34.3277C143.58 34.7441 143.767 35.2053 143.874 35.6966L145.255 35.909V37.5416L143.839 37.7594C143.721 38.2253 143.529 38.662 143.277 39.0566L144.14 40.233L142.985 41.3875L141.781 40.504C141.396 40.7318 140.974 40.9037 140.526 41.0083L140.297 42.5023H138.664L138.432 40.9961C137.992 40.8878 137.577 40.7142 137.199 40.4862L135.97 41.3876L134.815 40.2331L135.707 39.0169C135.469 38.6353 135.287 38.2152 135.172 37.7681L133.7 37.5416V35.909L135.137 35.688C135.241 35.2158 135.419 34.7717 135.659 34.3684L134.815 33.2176L135.97 32.0631L137.093 32.8865C137.504 32.6223 137.962 32.4237 138.451 32.3056L138.66 30.9484ZM141.681 36.6532C141.681 37.8549 140.707 38.829 139.505 38.829C138.303 38.829 137.329 37.8549 137.329 36.6532C137.329 35.4516 138.303 34.4775 139.505 34.4775C140.707 34.4775 141.681 35.4516 141.681 36.6532Z'
            fill='var(--neutral-0)'
            fillOpacity='0.40'
        />
        <rect
            x='54.755'
            y='79.4823'
            width='84'
            height='11.0354'
            fill='var(--center-channel-bg)'
            stroke='#1B1D22'
        />
        <rect
            opacity='0.3'
            x='57.2648'
            y='81.9911'
            width='78.9823'
            height='6.0177'
            fill='#BABEC9'
        />
        <rect
            x='57.2648'
            y='81.9911'
            width='52.6549'
            height='6.0177'
            fill='#BABEC9'
        />
        <path
            d='M150.255 108.5H122.755'
            stroke='var(--center-channel-color)'
            strokeLinecap='round'
            strokeLinejoin='round'
        />
        <path
            d='M119.255 108.5H113.255'
            stroke='var(--center-channel-color)'
            strokeLinecap='round'
        />
        <path
            d='M110.255 108.5H104.255'
            stroke='var(--center-channel-color)'
            strokeLinecap='round'
        />
    </svg>
);

export default SetupSystemSvg;
