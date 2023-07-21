// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {ActionCreatorsMapObject, bindActionCreators, Dispatch} from 'redux';

import {installApp} from 'actions/marketplace';
import {trackEvent} from 'actions/telemetry_actions.jsx';
import {closeModal} from 'actions/views/modals';
import {GenericAction} from 'mattermost-redux/types/actions';
import {getInstalling, getError} from 'selectors/views/marketplace';

import {GlobalState} from 'types/store';
import {ModalIdentifiers} from 'utils/constants';

import MarketplaceItemApp, {MarketplaceItemAppProps} from './marketplace_item_app';

type Props = {
    id: string;
}

function mapStateToProps(state: GlobalState, props: Props) {
    const installing = getInstalling(state, props.id);
    const error = getError(state, props.id);

    return {
        installing,
        error,
        trackEvent,
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject, MarketplaceItemAppProps['actions']>({
            installApp,
            closeMarketplaceModal: () => closeModal(ModalIdentifiers.PLUGIN_MARKETPLACE),
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(MarketplaceItemApp);
