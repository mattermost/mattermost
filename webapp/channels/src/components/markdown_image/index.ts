// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {ActionCreatorsMapObject, bindActionCreators, Dispatch} from 'redux';

import {openModal} from 'actions/views/modals';
import {Action, GenericAction} from 'mattermost-redux/types/actions';

import MarkdownImage, {Props} from './markdown_image';

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<Action>, Props['actions']>({
            openModal,
        }, dispatch),
    };
}

const connector = connect(null, mapDispatchToProps);

export default connector(MarkdownImage);
