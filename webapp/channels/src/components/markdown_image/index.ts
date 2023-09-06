// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';

import type {Action, GenericAction} from 'mattermost-redux/types/actions';

import {openModal} from 'actions/views/modals';

import MarkdownImage from './markdown_image';
import type {Props} from './markdown_image';

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<Action>, Props['actions']>({
            openModal,
        }, dispatch),
    };
}

const connector = connect(null, mapDispatchToProps);

export default connector(MarkdownImage);
