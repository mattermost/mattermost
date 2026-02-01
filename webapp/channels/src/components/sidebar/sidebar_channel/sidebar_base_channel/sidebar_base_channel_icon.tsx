// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';

import {
    getMdiIconPath,
    getLucideIconPaths,
    parseIconValue,
} from 'components/channel_settings_modal/icon_libraries';

import Constants from 'utils/constants';

type Props = {
    channelType: ChannelType;
    customIcon?: string;
}

// Render MDI icon (filled path)
function MdiSidebarIcon({name}: {name: string}) {
    const path = getMdiIconPath(name);
    if (!path) {
        return <i className='icon icon-globe'/>;
    }
    return (
        <svg
            className='sidebar-channel-icon sidebar-channel-icon--mdi'
            viewBox='0 0 24 24'
            width='16'
            height='16'
            fill='currentColor'
        >
            <path d={path}/>
        </svg>
    );
}

// Render Lucide icon (stroke-based)
function LucideSidebarIcon({name}: {name: string}) {
    const paths = getLucideIconPaths(name);
    if (!paths) {
        return <i className='icon icon-globe'/>;
    }
    return (
        <svg
            className='sidebar-channel-icon sidebar-channel-icon--lucide'
            viewBox='0 0 24 24'
            width='16'
            height='16'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
        >
            {paths.map((d, i) => (
                <path
                    key={i}
                    d={d}
                />
            ))}
        </svg>
    );
}

// Render custom SVG from base64
function CustomSvgSidebarIcon({base64}: {base64: string}) {
    try {
        const svgContent = atob(base64);
        // Sanitize: remove script tags and event handlers
        const sanitized = svgContent
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
            .replace(/javascript:/gi, '');

        return (
            <span
                className='sidebar-channel-icon sidebar-channel-icon--custom'
                dangerouslySetInnerHTML={{__html: sanitized}}
            />
        );
    } catch {
        return <i className='icon icon-globe'/>;
    }
}

const SidebarBaseChannelIcon = ({
    channelType,
    customIcon,
}: Props) => {
    if (customIcon) {
        const {format, name} = parseIconValue(customIcon);

        if (format === 'mdi' && name) {
            return <MdiSidebarIcon name={name}/>;
        }

        if (format === 'lucide' && name) {
            return <LucideSidebarIcon name={name}/>;
        }

        if (format === 'svg' && name) {
            return <CustomSvgSidebarIcon base64={name}/>;
        }
    }

    // Default icons
    if (channelType === Constants.OPEN_CHANNEL) {
        return (
            <i className='icon icon-globe'/>
        );
    }
    if (channelType === Constants.PRIVATE_CHANNEL) {
        return (
            <i className='icon icon-lock-outline'/>
        );
    }
    return null;
};

export default SidebarBaseChannelIcon;
