// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

type SvgProps = {
    width: number;
    height: number;
}


const ContactUsSvg = (props: SvgProps) => (
    <svg
        width={props.width ? props.width.toString() : '125'}
        height={props.height ? props.height.toString() : '97'}
        viewBox="0 0 125 97"
        fill='none'
        xmlns='http://www.w3.org/2000/svg'
    >
        <g clip-path="url(#clip0_4842_184301)">
            <rect opacity="0.08" width="50" height="50" rx="2" fill="#1C58D9" />
            <rect opacity="0.12" x="30" y="50" width="95" height="28" rx="2" fill="#1C58D9" />
            <circle cx="95.5" cy="32.5" r="2.5" fill="#3F4350" fill-opacity="0.48" />
            <circle cx="109" cy="32.5" r="2.5" fill="#3F4350" fill-opacity="0.48" />
            <circle cx="122.5" cy="32.5" r="2.5" fill="#3F4350" fill-opacity="0.48" />
            <path d="M95.0443 87.1199L105 97V46C105 44.8954 104.105 44 103 44H55C53.8954 44 53 44.8954 53 46V84.5395C53 85.644 53.8954 86.5395 55 86.5395H93.6355C94.1633 86.5395 94.6697 86.7481 95.0443 87.1199Z" fill="#28427B" />
            <path d="M67 65H97" stroke="white" stroke-linecap="round" />
            <path d="M67 72H86" stroke="white" stroke-linecap="round" />
            <path d="M67 59H77" stroke="white" stroke-linecap="round" />
            <path d="M80 59H93" stroke="white" stroke-linecap="round" />
            <path d="M27.605 69.5638L14 83V14C14 12.8954 14.8954 12 16 12H82C83.1046 12 84 12.8954 84 14V66.9868C84 68.0914 83.1046 68.9868 82 68.9868H29.0103C28.4842 68.9868 27.9793 69.1941 27.605 69.5638Z" fill="white" />
            <path d="M27.2536 69.2081L14.5 81.8035V14C14.5 13.1716 15.1716 12.5 16 12.5H82C82.8284 12.5 83.5 13.1716 83.5 14V66.9868C83.5 67.8153 82.8284 68.4868 82 68.4868H29.0103C28.3527 68.4868 27.7215 68.746 27.2536 69.2081Z" stroke="#3F4350" stroke-opacity="0.8" />
            <circle cx="32" cy="31" r="9" fill="#3F4350" fill-opacity="0.32" />
            <path d="M47 27H63" stroke="#3F4350" stroke-opacity="0.48" stroke-linecap="round" />
            <path d="M24 51H74" stroke="#3F4350" stroke-opacity="0.48" stroke-linecap="round" />
            <path d="M24 58H46" stroke="#3F4350" stroke-opacity="0.48" stroke-linecap="round" />
            <path d="M47 33H72" stroke="#3F4350" stroke-opacity="0.48" stroke-linecap="round" />
            <path d="M24 45H41" stroke="#3F4350" stroke-opacity="0.48" stroke-linecap="round" />
            <path d="M45 45H63" stroke="#3F4350" stroke-opacity="0.48" stroke-linecap="round" />
            <path d="M9 39.5L9 58L19.5 58" stroke="#3F4350" stroke-opacity="0.8" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M9 36.5L9 30.5" stroke="#3F4350" stroke-opacity="0.8" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M9 27.5L9 25.5" stroke="#3F4350" stroke-opacity="0.8" stroke-linecap="round" stroke-linejoin="round" />
        </g>
        <defs>
            <clipPath id="clip0_4842_184301">
                <rect width="125" height="97" fill="white" />
            </clipPath>
        </defs>
    </svg>
);

export default ContactUsSvg;