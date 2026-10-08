// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {JSX} from 'react';

import {PlusIcon} from '@mattermost/compass-icons/components';
import {IconButton} from '@mattermost/compass-ui/components/icon-button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import {mark} from 'actions/telemetry_actions';

import {Mark} from 'utils/performance_telemetry';

type Props = {
    url: string;
    tip: string | JSX.Element;
    label: string;
    switchTeam: (url: string) => void;
};

export default function AddTeamButton({url, tip, label, switchTeam}: Props) {
    return (
        <div className='team-container special'>
            <WithTooltip title={tip}>
                <IconButton
                    id={`${url.slice(1)}TeamButton`}
                    style='inverted'
                    size='medium'
                    icon={<PlusIcon size={24}/>}
                    aria-label={label}
                    onClick={() => {
                        mark(Mark.TeamLinkClicked);
                        switchTeam(url);
                    }}
                />
            </WithTooltip>
        </div>
    );
}
