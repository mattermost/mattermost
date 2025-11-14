// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

export function PinSVG(props: React.HTMLAttributes<HTMLSpanElement>) {
    const {formatMessage} = useIntl();

    return (
        <span {...props}>
            <svg
                width='97'
                height='87'
                viewBox='0 0 97 87'
                version='1.1'
                role='img'

                //fill='none'
                xmlns='http://www.w3.org/2000/svg'
                aria-label={formatMessage({id: 'generic_icons.pin', defaultMessage: 'Pin Icon'})}
            >

                <g clipPath='url(#clip0_4210_84719)'>
                    <path
                        d='M3.00196 35L3.00197 56L15.002 56'
                        stroke='var(--center-channel-color)'
                        strokeOpacity='0.32'
                        strokeLinecap='round'
                    />
                    <path
                        d='M3.00195 31L3.00195 25'
                        stroke='var(--center-channel-color)'
                        strokeOpacity='0.32'
                        strokeLinecap='round'
                    />
                    <path
                        d='M3.00195 22L3.00195 20'
                        stroke='var(--center-channel-color)'
                        strokeOpacity='0.32'
                        strokeLinecap='round'
                    />
                    <path
                        opacity='0.16'
                        d='M81.8711 78.899L90.002 87V45C90.002 43.8954 89.1065 43 88.002 43H49.002C47.8974 43 47.002 43.8954 47.002 45V76.3158C47.002 77.4204 47.8974 78.3158 49.002 78.3158H80.4595C80.9886 78.3158 81.4962 78.5255 81.8711 78.899Z'
                        fill='var(--button-bg)'
                    />
                    <path
                        d='M65.7715 65.5385H73.4638'
                        stroke='var(--center-channel-bg)'
                        strokeLinecap='round'
                    />
                    <path
                        d='M23.6069 67.5638L10.002 81V12C10.002 10.8954 10.8974 10 12.002 10H78.002C79.1065 10 80.002 10.8954 80.002 12V64.9868C80.002 66.0914 79.1065 66.9868 78.002 66.9868H25.0123C24.4862 66.9868 23.9812 67.1941 23.6069 67.5638Z'
                        fill='var(--center-channel-bg)'
                    />
                    <path
                        d='M23.2556 67.2081L10.502 79.8035V12C10.502 11.1716 11.1735 10.5 12.002 10.5H78.002C78.8304 10.5 79.502 11.1716 79.502 12V64.9868C79.502 65.8153 78.8304 66.4868 78.002 66.4868H25.0123C24.3546 66.4868 23.7235 66.746 23.2556 67.2081Z'
                        stroke='var(--center-channel-color)'
                        strokeOpacity='0.8'
                    />
                    <circle
                        cx='28.002'
                        cy='29'
                        r='9'
                        fill='var(--center-channel-color)'
                        fillOpacity='0.32'
                    />
                    <path
                        d='M43.002 25H59.002'
                        stroke='var(--center-channel-color)'
                        strokeOpacity='0.48'
                        strokeLinecap='round'
                    />
                    <path
                        d='M20.002 49H53.002'
                        stroke='var(--center-channel-color)'
                        strokeOpacity='0.48'
                        strokeLinecap='round'
                    />
                    <path
                        d='M20.002 56H42.002'
                        stroke='var(--center-channel-color)'
                        strokeOpacity='0.48'
                        strokeLinecap='round'
                    />
                    <path
                        d='M43.002 31H68.002'
                        stroke='var(--center-channel-color)'
                        strokeOpacity='0.48'
                        strokeLinecap='round'
                    />
                    <path
                        d='M20.002 43H37.002'
                        stroke='var(--center-channel-color)'
                        strokeOpacity='0.48'
                        strokeLinecap='round'
                    />
                    <path
                        d='M41.002 43H59.002'
                        stroke='var(--center-channel-color)'
                        strokeOpacity='0.48'
                        strokeLinecap='round'
                    />
                    <circle
                        cx='78.002'
                        cy='19'
                        r='19'
                        fill='#32539A'
                    />
                    <path
                        d='M79.9922 9L87.9922 17'
                        stroke='var(--button-color)'
                        strokeLinecap='round'
                    />
                    <path
                        d='M80.4922 27.5L69.4922 16.5C69.4922 16.5 72.4922 15 74.9922 16L80.9922 10L86.9922 16L80.9922 22C81.9922 24.5 80.4922 27.5 80.4922 27.5Z'
                        stroke='var(--button-color)'
                        strokeLinecap='round'
                    />
                    <path
                        d='M74.9922 22L69.9922 27'
                        stroke='var(--button-color)'
                        strokeLinecap='round'
                    />
                    <path
                        d='M73.002 49L94.002 49L94.002 37'
                        stroke='var(--center-channel-color)'
                        strokeOpacity='0.8'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                    />
                    <path
                        d='M69.002 49L63.002 49'
                        stroke='var(--center-channel-color)'
                        strokeOpacity='0.8'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                    />
                    <path
                        d='M60.002 49L58.002 49'
                        stroke='var(--center-channel-color)'
                        strokeOpacity='0.8'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                    />
                </g>
                <defs>
                    <clipPath id='clip0_4210_84719'>
                        <rect
                            width='97'
                            height='87'
                            fill='white'
                            transform='translate(0.00195312)'
                        />
                    </clipPath>
                </defs>
            </svg>
        </span>
    );
}
