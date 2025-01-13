// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {get} from 'mattermost-redux/selectors/entities/preferences';

import {openModal} from 'actions/views/modals';
import {getIsMobileView} from 'selectors/views/browser';

import {Preferences} from 'utils/constants';

import type {GlobalState} from 'types/store';

import PostImage from './post_image';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            openModal,
        }, dispatch),
    };
}

function mapStateToProps(state: GlobalState) {
    return {
        autoplayGifsAndEmojis: get(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.AUTOPLAY_GIFS_AND_EMOJIS, Preferences.AUTOPLAY_GIFS_AND_EMOJIS_DEFAULT),
        isMobileView: getIsMobileView(state),
    };
}

const connector = connect(mapStateToProps, mapDispatchToProps);

export default connector(PostImage);
