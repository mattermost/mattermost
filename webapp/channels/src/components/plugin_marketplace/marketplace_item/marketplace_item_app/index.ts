// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {installApp} from 'actions/marketplace';
import {closeModal} from 'actions/views/modals';
import {getInstalling, getError} from 'selectors/views/marketplace';

import {ModalIdentifiers} from 'utils/constants';

import type {GlobalState} from 'types/store';

import MarketplaceItemApp from './marketplace_item_app';

type Props = {
    id: string;
}

function mapStateToProps(state: GlobalState, props: Props) {
    const installing = getInstalling(state, props.id);
    const error = getError(state, props.id);

    return {
        installing,
        error,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            installApp,
            closeMarketplaceModal: () => closeModal(ModalIdentifiers.PLUGIN_MARKETPLACE),
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(MarketplaceItemApp);
