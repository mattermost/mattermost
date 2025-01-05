// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import type {ConnectedProps} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {getFilePublicLink} from 'mattermost-redux/actions/files';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {get} from 'mattermost-redux/selectors/entities/preferences';

import {toggleEmbedVisibility} from 'actions/post_actions';
import {openModal} from 'actions/views/modals';
import {getIsRhsOpen} from 'selectors/rhs';
import {getIsMobileView} from 'selectors/views/browser';

import SingleImageView from 'components/single_image_view/single_image_view';

import {Preferences} from 'utils/constants';

import type {GlobalState} from 'types/store';

function mapStateToProps(state: GlobalState) {
    const isRhsOpen = getIsRhsOpen(state);
    const config = getConfig(state);

    return {
        isRhsOpen,
        enablePublicLink: config.EnablePublicLink === 'true',
        autoplayGifsAndEmojis: get(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.AUTOPLAY_GIFS_AND_EMOJIS, Preferences.AUTOPLAY_GIFS_AND_EMOJIS_DEFAULT),
        isMobileView: getIsMobileView(state),
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
