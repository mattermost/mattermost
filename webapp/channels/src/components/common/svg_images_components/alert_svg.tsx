// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

type SvgProps = {
    width: number;
    height: number;
};

const AlertSvg = (props: SvgProps) => (
    <svg
        width={props.width ? props.width.toString() : '87'}
        height={props.height ? props.height.toString() : '70'}
        viewBox='0 0 87 70'
        fill='none'
        xmlns='http://www.w3.org/2000/svg'
    >
        <rect
            x='8.00098'
            y='7'
            width='72'
            height='24'
            rx='3.75'
            fill='var(--button-bg)'
            fillOpacity='0.12'
        />
        <rect
            x='0.000976562'
            y='34'
            width='87'
            height='25'
            rx='3.75'
            fill='var(--button-bg)'
            fillOpacity='0.12'
        />
        <path
            d='M38.3214 2.31098C39.4303 0.112261 42.5697 0.112256 43.6786 2.31098L71.7146 57.899C72.7209 59.8943 71.2707 62.25 69.0359 62.25H12.9641C10.7294 62.25 9.27912 59.8943 10.2854 57.899L38.3214 2.31098Z'
            fill='var(--center-channel-bg)'
        />
        <path
            d='M40.3214 4.31098C41.4303 2.11226 44.5697 2.11226 45.6786 4.31098L73.7146 59.899C74.7209 61.8943 73.2707 64.25 71.0359 64.25H14.9641C12.7294 64.25 11.2791 61.8943 12.2854 59.899L40.3214 4.31098Z'
            fill='#FFBC1F'
        />
        <path
            d='M43.2322 2.53614L71.2681 58.1242C72.1067 59.7869 70.8982 61.75 69.0359 61.75H12.9641C11.1018 61.75 9.89327 59.7869 10.7319 58.1242L38.7678 2.53614C39.6919 0.703873 42.3081 0.703871 43.2322 2.53614Z'
            stroke='var(--center-channel-color)'
        />
        <path
            d='M49.542 4.23999L52.8888 10.72M74.922 53.38L68.5073 40.96L66.8339 37.72L64.6027 33.4L61.5348 27.46M59.3036 23.14L55.12 15.04'
            stroke='var(--center-channel-color)'
            strokeOpacity='0.56'
            strokeWidth='1.08'
            strokeLinecap='round'
        />
        <path
            d='M38.0164 25.2833L40.2971 39.9301C40.3191 40.2208 40.4554 40.4927 40.6786 40.6912C40.9018 40.8897 41.1954 41 41.5002 41C41.8051 41 42.0986 40.8897 42.3219 40.6912C42.5451 40.4927 42.6814 40.2208 42.7034 39.9301L44.984 25.2833C45.3987 19.5722 37.5955 19.5722 38.0164 25.2833Z'
            fill='#3F4350'
        />
        <path
            d='M41.0072 47C41.798 47.0014 42.5706 47.2372 43.2275 47.6776C43.8843 48.118 44.396 48.7432 44.6976 49.4742C44.9993 50.2053 45.0774 51.0093 44.9222 51.7848C44.7671 52.5602 44.3856 53.2723 43.8259 53.831C43.2662 54.3897 42.5535 54.7699 41.7777 54.9237C41.002 55.0774 40.1981 54.9978 39.4676 54.6948C38.7371 54.3919 38.1128 53.8792 37.6736 53.2215C37.2344 52.5639 37 51.7908 37 51C37 50.4741 37.1036 49.9534 37.3051 49.4676C37.5066 48.9818 37.8019 48.5406 38.1741 48.169C38.5463 47.7975 38.9881 47.503 39.4743 47.3024C39.9604 47.1018 40.4813 46.9991 41.0072 47Z'
            fill='#3F4350'
        />
        <path
            d='M48.4619 68.5H70.0619'
            stroke='var(--center-channel-color)'
            strokeOpacity='0.56'
            strokeWidth='1.08'
            strokeLinecap='round'
        />
        <path
            d='M10.001 50L26.001 19'
            stroke='var(--center-channel-color)'
            strokeOpacity='0.56'
            strokeWidth='1.08'
            strokeLinecap='round'
        />
    </svg>

);

export default AlertSvg;
