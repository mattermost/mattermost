// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentType} from 'react';
import React from 'react';
import {defineMessages, useIntl} from 'react-intl';

import {MonitorIcon, CellphoneIcon, GlobeIcon} from '@mattermost/compass-icons/components';
import type IconProps from '@mattermost/compass-icons/components/props';

import {SESSION_PLATFORMS, type SessionPlatform} from './utils';

import './session_attributes.scss';

const ICONS: Record<SessionPlatform, ComponentType<IconProps>> = {
    desktop: MonitorIcon,
    mobile: CellphoneIcon,
    browser: GlobeIcon,
};

type Props = {
    platforms: SessionPlatform[];
};

export default function PlatformIcons({platforms}: Props) {
    const {formatMessage} = useIntl();

    return (
        <span
            className='SessionAttributes__platforms'
            data-testid='session-attribute-platforms'
        >
            {SESSION_PLATFORMS.map((platform) => {
                const Icon = ICONS[platform];
                const active = platforms.includes(platform);

                return (
                    <span
                        key={platform}
                        className='SessionAttributes__platform-slot'
                        data-platform={platform}
                        data-active={active}
                    >
                        <Icon
                            size={18}
                            aria-label={formatMessage(
                                active ? platformStateLabels.active : platformStateLabels.inactive,
                                {platform: formatMessage(platformLabels[platform])},
                            )}
                        />
                    </span>
                );
            })}
        </span>
    );
}

const platformLabels = defineMessages({
    desktop: {id: 'admin.session_attributes.platform.desktop', defaultMessage: 'Desktop'},
    mobile: {id: 'admin.session_attributes.platform.mobile', defaultMessage: 'Mobile'},
    browser: {id: 'admin.session_attributes.platform.browser', defaultMessage: 'Browser'},
});

// Icons only differ by styling, so the active/inactive state must be spelled out
// in the accessible name for screen-reader users.
const platformStateLabels = defineMessages({
    active: {id: 'admin.session_attributes.platform.active', defaultMessage: '{platform} (active)'},
    inactive: {id: 'admin.session_attributes.platform.inactive', defaultMessage: '{platform} (inactive)'},
});
