// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {getAllChannels as loadChannels, searchAllChannels} from 'mattermost-redux/actions/channels';

import {setModalSearchTerm} from 'actions/views/search';

import type {GlobalState} from 'types/store';

import ChannelSelectorModal from './channel_selector_modal';

function mapStateToProps(state: GlobalState) {
    return {
        searchTerm: state.views.search.modalSearch,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            loadChannels,
            setModalSearchTerm,
            searchAllChannels,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ChannelSelectorModal);
