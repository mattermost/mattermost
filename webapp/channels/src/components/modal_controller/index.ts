// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {ActionCreatorsMapObject, bindActionCreators, Dispatch} from 'redux';

import {GlobalState} from 'types/store/index.js';

import {Action, GenericAction} from 'mattermost-redux/types/actions.js';

import {closeModal} from 'actions/views/modals';

import ModalController from './modal_controller';

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
