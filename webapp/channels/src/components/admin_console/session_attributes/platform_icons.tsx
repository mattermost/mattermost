// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentType} from 'react';
import React from 'react';
import {defineMessages, useIntl} from 'react-intl';

import {MonitorIcon, CellphoneIcon, GlobeIcon} from '@mattermost/compass-icons/components';
import type IconProps from '@mattermost/compass-icons/components/props';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import {SESSION_PLATFORMS, type SessionPlatform} from './utils';

import './session_attributes.scss';

export const PLATFORM_ICONS: Record<SessionPlatform, ComponentType<IconProps>> = {
    desktop: MonitorIcon,
    mobile: CellphoneIcon,
    browser: GlobeIcon,
};

export const platformLabels = defineMessages({
    desktop: {id: 'admin.session_attributes.platform.desktop', defaultMessage: 'Desktop'},
    mobile: {id: 'admin.session_attributes.platform.mobile', defaultMessage: 'Mobile'},
    browser: {id: 'admin.session_attributes.platform.browser', defaultMessage: 'Web Browser'},
});

type Props = {
    platforms: SessionPlatform[];

    /** Show all platform slots with active/inactive styling (default), or only show active platforms */
    variant?: 'all-slots' | 'active-only';

    /** Icon size */
    size?: number;

    /** Optional className for the wrapper */
    className?: string;

    /** Optional className for individual icon wrappers */
    iconClassName?: string;

    /** Optional color override for icons */
    iconColor?: string;
};

export default function PlatformIcons({
    platforms,
    variant = 'all-slots',
    size = 18,
    className = 'SessionAttributes__platforms',
    iconClassName,
    iconColor,
}: Props) {
    const {formatMessage} = useIntl();

    const platformsToRender = variant === 'all-slots' ? SESSION_PLATFORMS : platforms;

    return (
        <span
            className={className}
            data-testid='session-attribute-platforms'
        >
            {platformsToRender.map((platform) => {
                const Icon = PLATFORM_ICONS[platform];
                if (!Icon) {
                    return null;
                }

                const active = platforms.includes(platform);
                const platformLabel = formatMessage(platformLabels[platform]);
                const accessibleLabel = variant === 'all-slots' ? formatMessage(
                    active ? platformStateLabels.active : platformStateLabels.inactive,
                    {platform: platformLabel},
                ) : platformLabel;

                return (
                    <span
                        key={platform}
                        className={variant === 'all-slots' ? 'SessionAttributes__platform-slot' : iconClassName}
                        data-platform={platform}
                        data-active={active}
                    >
                        <WithTooltip title={platformLabel}>
                            <span>
                                <Icon
                                    size={size}
                                    color={iconColor}
                                    aria-label={accessibleLabel}
                                />
                            </span>
                        </WithTooltip>
                    </span>
                );
            })}
        </span>
    );
}

// Icons only differ by styling, so the active/inactive state must be spelled out
// in the accessible name for screen-reader users.
const platformStateLabels = defineMessages({
    active: {id: 'admin.session_attributes.platform.active', defaultMessage: '{platform} (active)'},
    inactive: {id: 'admin.session_attributes.platform.inactive', defaultMessage: '{platform} (inactive)'},
});
