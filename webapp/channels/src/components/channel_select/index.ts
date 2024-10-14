// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';

import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getMyChannels} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentUserLocale} from 'mattermost-redux/selectors/entities/i18n';
import {sortChannelsByTypeAndDisplayName} from 'mattermost-redux/utils/channel_utils';

import ChannelSelect from './channel_select';

const getMyChannelsSorted = createSelector(
    'getMyChannelsSorted',
    getMyChannels,
    getCurrentUserLocale,
    (channels, locale) => {
        const activeChannels = channels.filter((channel) => channel.delete_at === 0);
        return [...activeChannels].sort(sortChannelsByTypeAndDisplayName.bind(null, locale));
    },
);

function mapStateToProps(state: GlobalState) {
    return {
        channels: getMyChannelsSorted(state),
    };
}

export default connect(mapStateToProps)(ChannelSelect);
