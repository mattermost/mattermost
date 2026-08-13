// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import type {OptionProps} from 'react-select';

import type {Team} from '@mattermost/types/teams';

import {TeamIcon} from 'components/widgets/team_icon/team_icon';

import * as Utils from 'utils/utils';

import type {AutocompleteOptionType} from '../user_multiselector/user_multiselector';

import './team_option.scss';

export function TeamOptionComponent(props: OptionProps<AutocompleteOptionType<Team>, true>) {
    const {data, innerProps} = props;

    const intl = useIntl();

    if (!data || !data.raw) {
        return null;
    }

    const team = data.raw;

    return (
        <div
            className='TeamOptionComponent'
            {...innerProps}
        >
            <TeamIcon
                size='xsm'
                url={Utils.imageURLForTeam(team)}
                content={team.display_name}
                intl={intl}
            />

            {team.display_name}
        </div>
    );
}
