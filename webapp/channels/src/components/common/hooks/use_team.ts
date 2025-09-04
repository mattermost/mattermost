// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Team} from '@mattermost/types/teams';

import {getTeam as getTeamAction} from 'mattermost-redux/actions/teams';
import {getTeam as getTeamSelector} from 'mattermost-redux/selectors/entities/teams';

import {makeUseEntity} from 'components/common/hooks/useEntity';

export const useTeam = makeUseEntity<Team>({
    name: 'useTeam',
    fetch: getTeamAction,
    selector: getTeamSelector,
});
