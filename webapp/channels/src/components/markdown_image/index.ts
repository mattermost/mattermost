// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {ActionCreatorsMapObject, bindActionCreators, Dispatch} from 'redux';
import {Action, ActionResult, GenericAction} from 'mattermost-redux/types/actions';

import {openModal} from 'actions/views/modals';
import {ModalData} from 'types/actions';

import MarkdownImage from './markdown_image';

type Actions = {
    openModal: (modalData: ModalData<unknown>) => Promise<ActionResult>;
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<Action>, Actions>({
            openModal,
        }, dispatch),
    };
}

const connector = connect(null, mapDispatchToProps);

export default connector(MarkdownImage);
