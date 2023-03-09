// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {ActionCreatorsMapObject, bindActionCreators, Dispatch} from 'redux';

import {getAllChannels as loadChannels, searchAllChannels} from 'mattermost-redux/actions/channels';

import {ChannelWithTeamData, ChannelSearchOpts} from '@mattermost/types/channels';

import {ActionFunc, ActionResult, GenericAction} from 'mattermost-redux/types/actions';

import {setModalSearchTerm} from 'actions/views/search';

import {GlobalState} from '../../types/store';

import ChannelSelectorModal from './channel_selector_modal';

type Actions = {
    loadChannels: (page?: number, perPage?: number, notAssociatedToGroup?: string, excludeDefaultChannels?: boolean) => Promise<{data: ChannelWithTeamData[]}>;
    setModalSearchTerm: (term: string) => ActionResult;
    searchAllChannels: (term: string, opts?: ChannelSearchOpts) => Promise<{data: ChannelWithTeamData[]}>;
}

function mapStateToProps(state: GlobalState) {
    return {
        searchTerm: state.views.search.modalSearch,
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc|GenericAction>, Actions>({
            loadChannels,
            setModalSearchTerm,
            searchAllChannels,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ChannelSelectorModal);
