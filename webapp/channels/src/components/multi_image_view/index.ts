// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import type {ConnectedProps} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

import {openModal} from 'actions/views/modals';

import type {GlobalState} from 'types/store';

import MultiImageView from './multi_image_view';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);
    const imageSmallerEnabled = config.FeatureFlagImageSmaller === 'true';

    return {
        // Only pass max dimensions if ImageSmaller is enabled
        maxImageHeight: imageSmallerEnabled ? parseInt(config.MattermostExtendedMediaMaxImageHeight || '400', 10) : 0,
        maxImageWidth: imageSmallerEnabled ? parseInt(config.MattermostExtendedMediaMaxImageWidth || '500', 10) : 0,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            openModal,
        }, dispatch),
    };
}

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(MultiImageView);
