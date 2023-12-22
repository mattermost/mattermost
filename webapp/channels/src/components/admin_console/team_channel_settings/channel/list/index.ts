// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch, ActionCreatorsMapObject} from 'redux';

import type {ChannelWithTeamData, ChannelSearchOpts} from '@mattermost/types/channels';

import {getAllChannelsWithCount as getData, searchAllChannels} from 'mattermost-redux/actions/channels';
import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getAllChannels} from 'mattermost-redux/selectors/entities/channels';
import type {GenericAction, ActionFunc, ActionResult} from 'mattermost-redux/types/actions';

import {Constants} from 'utils/constants';

import type {GlobalState} from 'types/store';

import List from './channel_list';

const compareByDisplayName = (a: {display_name: string}, b: {display_name: string}) => a.display_name.localeCompare(b.display_name);

const getSortedListOfChannels = createSelector(
    'getSortedListOfChannels',
    getAllChannels,
    (teams) => Object.values(teams).
        filter((c) => (c.type === Constants.OPEN_CHANNEL || c.type === Constants.PRIVATE_CHANNEL)).
        sort(compareByDisplayName),
);

function mapStateToProps(state: GlobalState) {
    return {
        data: getSortedListOfChannels(state) as ChannelWithTeamData[],
        total: state.entities.channels.totalCount,
    };
}

type Actions = {
    searchAllChannels: (term: string, opts: ChannelSearchOpts) => Promise<{ data: any }>;
    getData: (page: number, perPage: number, notAssociatedToGroup?: string, excludeDefaultChannels?: boolean, includeDeleted?: boolean) => ActionFunc | ActionResult | Promise<ChannelWithTeamData[]>;
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Actions>({
            getData,
            searchAllChannels,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(List);
