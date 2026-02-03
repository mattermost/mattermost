// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

export function MentionsSVG(props: React.HTMLAttributes<HTMLSpanElement>) {
    const {formatMessage} = useIntl();
    return (
        <span {...props}>
            <svg
                width='97'
                height='87'
                viewBox='0 0 97 87'
                fill='none'
                xmlns='http://www.w3.org/2000/svg'
                aria-label={formatMessage({id: 'generic_icons.mention', defaultMessage: 'Mention Icon'})}
            >
                <path
                    d='M3.00001 35L3.00001 56L15 56'
                    stroke='var(--center-channel-color)'
                    strokeOpacity='0.32'
                    strokeLinecap='round'
                />
                <path
                    d='M3 31L3 25'
                    stroke='var(--center-channel-color)'
                    strokeOpacity='0.32'
                    strokeLinecap='round'
                />
                <path
                    d='M3 22L3 20'
                    stroke='var(--center-channel-color)'
                    strokeOpacity='0.32'
                    strokeLinecap='round'
                />
                <path
                    opacity='0.16'
                    d='M81.8691 78.899L90 87V45C90 43.8954 89.1046 43 88 43H49C47.8954 43 47 43.8954 47 45V76.3158C47 77.4204 47.8954 78.3158 49 78.3158H80.4575C80.9867 78.3158 81.4943 78.5255 81.8691 78.899Z'
                    fill='var(--button-bg)'
                />
                <path
                    d='M65.7695 65.5385H73.4618'
                    stroke='var(--center-channel-bg)'
                    strokeLinecap='round'
                />
                <path
                    d='M23.605 67.5638L10 81V12C10 10.8954 10.8954 10 12 10H78C79.1046 10 80 10.8954 80 12V64.9868C80 66.0914 79.1046 66.9868 78 66.9868H25.0103C24.4842 66.9868 23.9793 67.1941 23.605 67.5638Z'
                    fill='var(--center-channel-bg)'
                />
                <path
                    d='M23.2536 67.2081L10.5 79.8035V12C10.5 11.1716 11.1716 10.5 12 10.5H78C78.8284 10.5 79.5 11.1716 79.5 12V64.9868C79.5 65.8153 78.8284 66.4868 78 66.4868H25.0103C24.3527 66.4868 23.7215 66.746 23.2536 67.2081Z'
                    stroke='var(--center-channel-color)'
                    strokeOpacity='0.8'
                />
                <circle
                    cx='28'
                    cy='29'
                    r='9'
                    fill='var(--center-channel-color)'
                    fillOpacity='0.32'
                />
                <path
                    d='M43 25H59'
                    stroke='var(--center-channel-color)'
                    strokeOpacity='0.48'
                    strokeLinecap='round'
                />
                <path
                    d='M20 49H53'
                    stroke='var(--center-channel-color)'
                    strokeOpacity='0.48'
                    strokeLinecap='round'
                />
                <path
                    d='M20 56H42'
                    stroke='var(--center-channel-color)'
                    strokeOpacity='0.48'
                    strokeLinecap='round'
                />
                <path
                    d='M43 31H68'
                    stroke='var(--center-channel-color)'
                    strokeOpacity='0.48'
                    strokeLinecap='round'
                />
                <path
                    d='M20 43H37'
                    stroke='var(--center-channel-color)'
                    strokeOpacity='0.48'
                    strokeLinecap='round'
                />
                <path
                    d='M41 43H59'
                    stroke='var(--center-channel-color)'
                    strokeOpacity='0.48'
                    strokeLinecap='round'
                />
                <circle
                    cx='78'
                    cy='19'
                    r='19'
                    fill='#32539A'
                />
                <path
                    d='M73 49L94 49L94 37'
                    stroke='var(--center-channel-color)'
                    strokeOpacity='0.8'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                />
                <path
                    d='M69 49L63 49'
                    stroke='var(--center-channel-color)'
                    strokeOpacity='0.8'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                />
                <path
                    d='M60 49L58 49'
                    stroke='var(--center-channel-color)'
                    strokeOpacity='0.8'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                />
                <circle
                    cx='77.9922'
                    cy='19'
                    r='5'
                    stroke='var(--button-color)'
                />
                <path
                    d='M82.9922 19C82.9922 19.1667 82.9922 19.8 82.9922 21C82.9922 22.2 83.9922 24 85.4922 24C86.9922 24 87.9922 23 87.9922 19'
                    stroke='var(--button-color)'
                    strokeLinecap='round'
                />
                <path
                    d='M87.9922 19C87.9922 13.4772 83.515 9 77.9922 9C72.4693 9 67.9922 13.4772 67.9922 19C67.9922 24.5228 72.4693 29 77.9922 29C79.4144 29 80.7673 28.7031 81.9922 28.1679'
                    stroke='var(--button-color)'
                    strokeLinecap='round'
                />
            </svg>
        </span>
    );
}
