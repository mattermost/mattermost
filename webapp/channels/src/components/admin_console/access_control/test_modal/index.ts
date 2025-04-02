// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {openModal} from 'actions/views/modals';
import {isModalOpen} from 'selectors/views/modals';

import type {GlobalState} from 'types/store';

import TestResultsModal from './test_modal';
import { ModalIdentifiers } from 'utils/constants';
import type {ActionResult} from 'mattermost-redux/types/actions';
function mapStateToProps(state: GlobalState) {
    const modalId = ModalIdentifiers.TEAM_MEMBERS;
    return {
        show: isModalOpen(state, modalId),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            openModal,
            setModalSearchTerm: (term: string): ActionResult => ({data: term}),
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(TestResultsModal);
