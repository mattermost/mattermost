// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {getPluginStatus} from 'mattermost-redux/selectors/entities/admin';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

import {installPlugin} from 'actions/marketplace';
import {trackEvent} from 'actions/telemetry_actions.jsx';
import {closeModal} from 'actions/views/modals';
import {getInstalling, getError} from 'selectors/views/marketplace';

import {ModalIdentifiers} from 'utils/constants';

import type {GlobalState} from 'types/store';

import MarketplaceItemPlugin from './marketplace_item_plugin';

type Props = {
    id: string;
}

function mapStateToProps(state: GlobalState, props: Props) {
    const installing = getInstalling(state, props.id);
    const error = getError(state, props.id);
    const isDefaultMarketplace = getConfig(state).IsDefaultMarketplace === 'true';

    const pluginStatus = getPluginStatus(state, props.id);

    return {
        installing,
        error,
        isDefaultMarketplace,
        trackEvent,
        pluginStatus,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            installPlugin,
            closeMarketplaceModal: () => closeModal(ModalIdentifiers.PLUGIN_MARKETPLACE),
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(MarketplaceItemPlugin);
