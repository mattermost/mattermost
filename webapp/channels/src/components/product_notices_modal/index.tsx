// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {getInProductNotices, updateNoticesAsViewed} from 'mattermost-redux/actions/teams';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {getSocketStatus} from 'selectors/views/websocket';

import ProductNoticesModal from './product_notices_modal';

import type {ClientConfig} from '@mattermost/types/config';
import type {ProductNotices} from '@mattermost/types/product_notices';
import type {ActionFunc} from 'mattermost-redux/types/actions';
import type {ConnectedProps} from 'react-redux';
import type {Dispatch, ActionCreatorsMapObject} from 'redux';
import type {GlobalState} from 'types/store';

type Actions = {
    getInProductNotices: (teamId: string, client: string, clientVersion: string) => Promise<{
        data: ProductNotices;
    }>;
    updateNoticesAsViewed: (noticeIds: string[]) => Promise<Record<string, unknown>>;
}

function mapStateToProps(state: GlobalState) {
    const config: Partial<ClientConfig> = getConfig(state);
    const version: string = config.Version || ''; //this should always exist but TS throws error
    const socketStatus = getSocketStatus(state);

    return {
        currentTeamId: getCurrentTeamId(state),
        version,
        socketStatus,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Actions>({
            getInProductNotices,
            updateNoticesAsViewed,
        }, dispatch),
    };
}

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(ProductNoticesModal);
