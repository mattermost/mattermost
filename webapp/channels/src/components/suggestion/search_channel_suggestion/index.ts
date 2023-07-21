// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Channel} from '@mattermost/types/channels';
import {connect} from 'react-redux';

import {getDirectTeammate} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {GlobalState} from 'types/store';

import SearchChannelSuggestion from './search_channel_suggestion';

type OwnProps = {
    item: Channel;
}

const mapStateToProps = (state: GlobalState, ownProps: OwnProps) => {
    const teammate = getDirectTeammate(state, ownProps.item.id);

    return {
        teammateIsBot: Boolean(teammate && teammate.is_bot),
        currentUserId: getCurrentUserId(state),
    };
};

export default connect(mapStateToProps, null, null, {forwardRef: true})(SearchChannelSuggestion);
