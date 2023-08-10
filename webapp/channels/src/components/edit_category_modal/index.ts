// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {renameCategory} from 'mattermost-redux/actions/channel_categories';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {createCategory} from 'actions/views/channel_sidebar';

import EditCategoryModal from './edit_category_modal';

import type {ChannelCategory} from '@mattermost/types/channel_categories';
import type {ActionFunc} from 'mattermost-redux/types/actions';
import type {Dispatch, ActionCreatorsMapObject} from 'redux';
import type {GlobalState} from 'types/store';

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
