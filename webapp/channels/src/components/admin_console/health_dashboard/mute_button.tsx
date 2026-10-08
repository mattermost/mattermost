// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {BellOffOutlineIcon, BellOutlineIcon} from '@mattermost/compass-icons/components';
import type {HealthFinding} from '@mattermost/types/health';

import {isHealthFindingMuted} from 'mattermost-redux/utils/health_utils';

type Props = {
    finding: HealthFinding;
    onMute: (fingerprint: string) => void;
    onUnmute: (fingerprint: string) => void;
};

const iconProps = {size: 16, color: 'currentColor', 'aria-hidden': true} as const;

const MuteButton = ({finding, onMute, onUnmute}: Props) => {
    if (isHealthFindingMuted(finding)) {
        return (
            <button
                type='button'
                className='btn btn-tertiary btn-sm HealthFinding__muteButton'
                onClick={() => onUnmute(finding.fingerprint)}
            >
                <BellOutlineIcon {...iconProps}/>
                <FormattedMessage
                    id='admin.health_dashboard.mute.unmute'
                    defaultMessage='Unmute'
                />
            </button>
        );
    }

    if (finding.state !== 'firing' && finding.state !== 'unknown') {
        return null;
    }

    return (
        <button
            type='button'
            className='btn btn-tertiary btn-sm HealthFinding__muteButton'
            onClick={() => onMute(finding.fingerprint)}
        >
            <BellOffOutlineIcon {...iconProps}/>
            <FormattedMessage
                id='admin.health_dashboard.mute.mute'
                defaultMessage='Mute'
            />
        </button>
    );
};

export default MuteButton;
