// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {BellOffOutlineIcon, BellOutlineIcon} from '@mattermost/compass-icons/components';
import type {HealthFinding} from '@mattermost/types/health';

import {isHealthFindingMuted, isHealthFindingOpen} from 'mattermost-redux/utils/health_utils';

type Props = {
    finding: HealthFinding;
    onMute: (finding: HealthFinding) => void;
    onUnmute: (fingerprint: string) => void;
};

const MuteButton = ({finding, onMute, onUnmute}: Props) => {
    const muted = isHealthFindingMuted(finding);
    if (!muted && !isHealthFindingOpen(finding)) {
        return null;
    }

    const Icon = muted ? BellOutlineIcon : BellOffOutlineIcon;

    return (
        <button
            type='button'
            className='btn btn-tertiary btn-sm HealthFinding__muteButton'
            onClick={() => (muted ? onUnmute(finding.fingerprint) : onMute(finding))}
        >
            <Icon
                size={16}
                color='currentColor'
                aria-hidden={true}
            />
            {muted ? (
                <FormattedMessage
                    id='admin.health_dashboard.mute.unmute'
                    defaultMessage='Unmute'
                />
            ) : (
                <FormattedMessage
                    id='admin.health_dashboard.mute.mute'
                    defaultMessage='Mute'
                />
            )}
        </button>
    );
};

export default MuteButton;
