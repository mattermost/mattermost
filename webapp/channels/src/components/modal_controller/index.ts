// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {closeModal} from 'actions/views/modals';

import type {GlobalState} from 'types/store/index.js';

import ModalController from './modal_controller';

function mapStateToProps(state: GlobalState) {
    return {
        modals: state.views.modals,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            closeModal,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ModalController);
