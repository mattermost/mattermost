// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable react/jsx-max-props-per-line */

import React from 'react';

type ThemeThumbnailProps = {
    themeName?: string;
    themeKey: string;
    sidebarBg: string;
    sidebarText: string;
    sidebarUnreadText: string;
    onlineIndicator: string;
    awayIndicator: string;
    dndIndicator: string;
    centerChannelColor: string;
    centerChannelBg: string;
    newMessageSeparator: string;
    buttonBg: string;
}

function ThemeThumbnail({
    themeName,
    themeKey,
    sidebarBg = '#174AB5',
    sidebarText = '#86A1D9',
    sidebarUnreadText = 'white',
    onlineIndicator = '#3DB887',
    awayIndicator = '#FFBC1F',
    dndIndicator = '#D24B4E',
    centerChannelColor = '#E0E1E3',
    centerChannelBg = 'white',
    newMessageSeparator = '#1C58D9',
    buttonBg = '#15B7B7',
}: ThemeThumbnailProps): JSX.Element {
    return (
        <svg width='112' height='86' viewBox='0 0 112 86' fill='none' xmlns='http://www.w3.org/2000/svg' aria-labelledby={`${themeKey}-theme-icon`} role='img'>
            <title id={`${themeKey}-theme-icon`}>{`${themeName} theme icon`}</title>
            <rect style={{fill: centerChannelBg}} x='0' y='0' width='112' height='86'/>
            <g>
                <rect style={{fill: centerChannelBg}} x='50' y='-1' width='63' height='88'/>
                <g>
                    <rect style={{fill: centerChannelColor}} x='55' y='75' width='52' height='6' rx='3'/>
                    <rect style={{fill: centerChannelBg}} x='56' y='76' width='50' height='4' rx='2'/>
                </g>
                <rect style={{fill: buttonBg}} x='71' y='65' width='22' height='5' rx='2.5'/>
                <rect style={{fill: newMessageSeparator}} x='50' y='32' width='62' height='1'/>
                <g style={{fill: centerChannelColor}}>
                    <rect x='55' y='5' width='52' height='4' rx='2'/>
                    <rect x='55' y='14' width='52' height='4' rx='2'/>
                    <rect x='55' y='23' width='52' height='4' rx='2'/>
                    <rect x='55' y='38' width='52' height='4' rx='2'/>
                    <rect x='55' y='47' width='52' height='4' rx='2'/>
                    <rect x='55' y='56' width='52' height='4' rx='2'/>
                </g>
            </g>
            <g>
                <rect style={{fill: sidebarBg}} x='-1' y='-1' width='51' height='88'/>
                <g style={{fill: sidebarText}}>
                    <circle cx='7' cy='61' r='2'/>
                    <circle cx='7' cy='70' r='2'/>
                    <circle cx='7' cy='43' r='2'/>
                    <circle cx='7' cy='34' r='2'/>
                    <circle cx='7' cy='16' r='2'/>
                    <circle cx='7' cy='7' r='2'/>
                    <rect x='11' y='5' width='28' height='4' rx='2'/>
                    <rect x='11' y='14' width='28' height='4' rx='2'/>
                    <rect x='11' y='32' width='28' height='4' rx='2'/>
                    <rect x='11' y='41' width='28' height='4' rx='2'/>
                    <rect x='11' y='50' width='28' height='4' rx='2'/>
                    <rect x='11' y='59' width='28' height='4' rx='2'/>
                    <rect x='11' y='68' width='28' height='4' rx='2'/>
                    <rect x='11' y='77' width='28' height='4' rx='2'/>
                </g>
                <circle style={{fill: dndIndicator}} cx='7' cy='79' r='2'/>
                <circle style={{fill: awayIndicator}} cx='7' cy='52' r='2'/>
                <circle style={{fill: onlineIndicator}} cx='7' cy='25' r='2'/>
                <g style={{fill: sidebarUnreadText}}>
                    <circle cx='43' cy='25' r='2'/>
                    <rect x='11' y='23' width='28' height='4' rx='2'/>
                </g>
            </g>
        </svg>
    );
}

export default ThemeThumbnail;
