// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {GlobalState} from 'types/store';

import {doPostActionWithCookie} from 'mattermost-redux/actions/posts';
import {getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';

import {openModal} from 'actions/views/modals';

import MessageAttachment from './message_attachment';

import {get} from 'mattermost-redux/selectors/entities/preferences';
import {getIsMobileView} from 'selectors/views/browser';
import {Preferences} from 'utils/constants';

function mapStateToProps(state: GlobalState) {
    return {
        currentRelativeTeamUrl: getCurrentRelativeTeamUrl(state),
        autoplayGifsAndEmojis: get(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.AUTOPLAY_GIFS_AND_EMOJIS, Preferences.AUTOPLAY_GIFS_AND_EMOJIS_DEFAULT),
        isMobileView: getIsMobileView(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            doPostActionWithCookie, openModal,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(MessageAttachment);
