// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators, Dispatch, ActionCreatorsMapObject} from 'redux';

import {renameCategory} from 'mattermost-redux/actions/channel_categories';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {ActionFunc} from 'mattermost-redux/types/actions';
import {ChannelCategory} from '@mattermost/types/channel_categories';

import {createCategory} from 'actions/views/channel_sidebar';
import {GlobalState} from 'types/store';

import EditCategoryModal from './edit_category_modal';

function mapStateToProps(state: GlobalState) {
    const currentTeam = getCurrentTeam(state);

    return {
        currentTeamId: currentTeam.id,
    };
}

type Actions = {
    createCategory: (teamId: string, displayName: string, channelIds?: string[] | undefined) => {data: ChannelCategory};
    renameCategory: (categoryId: string, displayName: string) => void;
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Actions>({
            createCategory,
            renameCategory,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(EditCategoryModal);
