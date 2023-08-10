// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {doPostActionWithCookie} from 'mattermost-redux/actions/posts';
import {getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';

import {openModal} from 'actions/views/modals';

import MessageAttachment from './message_attachment';

import type {GlobalState} from '@mattermost/types/store';
import type {ActionFunc, ActionResult, GenericAction} from 'mattermost-redux/types/actions';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';
import type {ModalData} from 'types/actions';

function mapStateToProps(state: GlobalState) {
    return {
        currentRelativeTeamUrl: getCurrentRelativeTeamUrl(state),
    };
}

type Actions = {
    doPostActionWithCookie: (postId: string, actionId: string, actionCookie: string, selectedOption?: string | undefined) => Promise<ActionResult>;
    openModal: <P>(modalData: ModalData<P>) => void;
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc | GenericAction>, Actions>({
            doPostActionWithCookie, openModal,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(MessageAttachment);
