// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {ActionCreatorsMapObject, bindActionCreators, Dispatch} from 'redux';

import {installPlugin} from 'actions/marketplace';
import {trackEvent} from 'actions/telemetry_actions.jsx';
import {closeModal} from 'actions/views/modals';
import {getPluginStatus} from 'mattermost-redux/selectors/entities/admin';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {GenericAction} from 'mattermost-redux/types/actions';
import {getInstalling, getError} from 'selectors/views/marketplace';

import {GlobalState} from 'types/store';
import {ModalIdentifiers} from 'utils/constants';

import MarketplaceItemPlugin, {MarketplaceItemPluginProps} from './marketplace_item_plugin';

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

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject, MarketplaceItemPluginProps['actions']>({
            installPlugin,
            closeMarketplaceModal: () => closeModal(ModalIdentifiers.PLUGIN_MARKETPLACE),
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(MarketplaceItemPlugin);
