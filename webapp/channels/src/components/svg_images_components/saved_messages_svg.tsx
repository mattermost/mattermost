// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

export function SavedMessagesSVG(props: React.HTMLAttributes<HTMLSpanElement>) {
    const {formatMessage} = useIntl();
    return (
        <span {...props}>
            <svg
                width='97'
                height='87'
                viewBox='0 0 97 87'
                fill='none'
                role='img'
                aria-label={formatMessage({id: 'generic_icons.flag', defaultMessage: 'Flag Icon'})}
            >
                <g clipPath='url(#clip0_4210_81120)'>
                    <path
                        d='M3.00391 35L3.00392 56L15.0039 56'
                        stroke='var(--center-channel-color)'
                        strokeOpacity='0.32'
                        strokeLinecap='round'
                    />
                    <path
                        d='M3.00391 31L3.00391 25'
                        stroke='var(--center-channel-color)'
                        strokeOpacity='0.32'
                        strokeLinecap='round'
                    />
                    <path
                        d='M3.00391 22L3.00391 20'
                        stroke='var(--center-channel-color)'
                        strokeOpacity='0.32'
                        strokeLinecap='round'
                    />
                    <path
                        opacity='0.16'
                        d='M81.873 78.899L90.0039 87V45C90.0039 43.8954 89.1085 43 88.0039 43H49.0039C47.8993 43 47.0039 43.8954 47.0039 45V76.3158C47.0039 77.4204 47.8993 78.3158 49.0039 78.3158H80.4614C80.9906 78.3158 81.4982 78.5255 81.873 78.899Z'
                        fill='var(--button-bg)'
                    />
                    <path
                        d='M65.7734 65.5385H73.4657'
                        stroke='var(--center-channel-bg)'
                        strokeLinecap='round'
                    />
                    <path
                        d='M23.6089 67.5638L10.0039 81V12C10.0039 10.8954 10.8993 10 12.0039 10H78.0039C79.1085 10 80.0039 10.8954 80.0039 12V64.9868C80.0039 66.0914 79.1085 66.9868 78.0039 66.9868H25.0142C24.4881 66.9868 23.9832 67.1941 23.6089 67.5638Z'
                        fill='var(--center-channel-bg)'
                    />
                    <path
                        d='M23.2575 67.2081L10.5039 79.8035V12C10.5039 11.1716 11.1755 10.5 12.0039 10.5H78.0039C78.8323 10.5 79.5039 11.1716 79.5039 12V64.9868C79.5039 65.8153 78.8323 66.4868 78.0039 66.4868H25.0142C24.3566 66.4868 23.7254 66.746 23.2575 67.2081Z'
                        stroke='var(--center-channel-color)'
                        strokeOpacity='0.8'
                    />
                    <circle
                        cx='28.0039'
                        cy='29'
                        r='9'
                        fill='var(--center-channel-color)'
                        fillOpacity='0.32'
                    />
                    <path
                        d='M43.0039 25H59.0039'
                        stroke='var(--center-channel-color)'
                        strokeOpacity='0.48'
                        strokeLinecap='round'
                    />
                    <path
                        d='M20.0039 49H53.0039'
                        stroke='var(--center-channel-color)'
                        strokeOpacity='0.48'
                        strokeLinecap='round'
                    />
                    <path
                        d='M20.0039 56H42.0039'
                        stroke='var(--center-channel-color)'
                        strokeOpacity='0.48'
                        strokeLinecap='round'
                    />
                    <path
                        d='M43.0039 31H68.0039'
                        stroke='var(--center-channel-color)'
                        strokeOpacity='0.48'
                        strokeLinecap='round'
                    />
                    <path
                        d='M20.0039 43H37.0039'
                        stroke='var(--center-channel-color)'
                        strokeOpacity='0.48'
                        strokeLinecap='round'
                    />
                    <path
                        d='M41.0039 43H59.0039'
                        stroke='var(--center-channel-color)'
                        strokeOpacity='0.48'
                        strokeLinecap='round'
                    />
                    <circle
                        cx='78.0039'
                        cy='19'
                        r='19'
                        fill='#32539A'
                    />
                    <path
                        d='M70.9922 12V27L77.9922 24L84.9922 27V12C84.9922 10.8954 84.0968 10 82.9922 10H72.9922C71.8876 10 70.9922 10.8954 70.9922 12Z'
                        stroke='var(--button-color)'
                    />
                    <path
                        d='M73.0039 49L94.0039 49L94.0039 37'
                        stroke='var(--center-channel-color)'
                        strokeOpacity='0.8'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                    />
                    <path
                        d='M69.0039 49L63.0039 49'
                        stroke='var(--center-channel-color)'
                        strokeOpacity='0.8'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                    />
                    <path
                        d='M60.0039 49L58.0039 49'
                        stroke='var(--center-channel-color)'
                        strokeOpacity='0.8'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                    />
                </g>
                <defs>
                    <clipPath id='clip0_4210_81120'>
                        <rect
                            width='97'
                            height='87'
                            fill='white'
                            transform='translate(0.00390625)'
                        />
                    </clipPath>
                </defs>
            </svg>
        </span>
    );
}
