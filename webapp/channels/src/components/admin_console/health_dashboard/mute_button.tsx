// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {BellOffOutlineIcon, BellOutlineIcon} from '@mattermost/compass-icons/components';
import {Button} from '@mattermost/compass-ui/components/button';
import {Icon} from '@mattermost/compass-ui/components/icon';
import type {HealthFinding} from '@mattermost/types/health';

import {isHealthFindingMuted, isHealthFindingOpen} from 'mattermost-redux/utils/health_utils';

type Props = {
    finding: HealthFinding;
    onMute: (fingerprint: string) => void;
    onUnmute: (fingerprint: string) => void;
};

const MuteButton = ({finding, onMute, onUnmute}: Props) => {
    const muted = isHealthFindingMuted(finding);
    if (!muted && !isHealthFindingOpen(finding)) {
        return null;
    }

    const BellIcon = muted ? BellOutlineIcon : BellOffOutlineIcon;

    return (
        <Button
            emphasis='dim'
            size='small'
            leadingIcon={<Icon glyph={<BellIcon/>}/>}
            onClick={() => (muted ? onUnmute : onMute)(finding.fingerprint)}
        >
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
        </Button>
    );
};

export default MuteButton;
