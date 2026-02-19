// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import type {ConnectedProps} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {FileInfo} from '@mattermost/types/files';

import {getFilePublicLink} from 'mattermost-redux/actions/files';
import {isFileRejected} from 'mattermost-redux/selectors/entities/files';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

import {toggleEmbedVisibility} from 'actions/post_actions';
import {openModal} from 'actions/views/modals';
import {getIsRhsOpen} from 'selectors/rhs';

import SingleImageView from 'components/single_image_view/single_image_view';

import type {GlobalState} from 'types/store';

type OwnProps = {
    fileInfo: FileInfo;
};

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    const isRhsOpen = getIsRhsOpen(state);
    const config = getConfig(state);

    return {
        enablePublicLink: config.EnablePublicLink === 'true',
        isFileRejected: isFileRejected(state, ownProps.fileInfo.id),
        isRhsOpen,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            toggleEmbedVisibility,
            openModal,
            getFilePublicLink,
        }, dispatch),
    };
}

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(SingleImageView);
