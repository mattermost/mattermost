// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {closeModal} from 'actions/views/modals';

import ModalController from './modal_controller';

import type {Action, GenericAction} from 'mattermost-redux/types/actions.js';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';
import type {GlobalState} from 'types/store/index.js';

function mapStateToProps(state: GlobalState) {
    return {
        modals: state.views.modals,
    };
}

type Actions = {
    closeModal: (modalId: string) => void;
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<Action>, Actions>({
            closeModal,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ModalController);
