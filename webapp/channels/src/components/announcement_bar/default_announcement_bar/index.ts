// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators, Dispatch} from 'redux';

import {GenericAction} from 'mattermost-redux/types/actions';

import {incrementAnnouncementBarCount, decrementAnnouncementBarCount} from 'actions/views/announcement_bar';
import {getAnnouncementBarCount} from 'selectors/views/announcement_bar';
import {GlobalState} from 'types/store';

import AnnouncementBar from './announcement_bar';

function mapStateToProps(state: GlobalState) {
    return {
        announcementBarCount: getAnnouncementBarCount(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators({
            incrementAnnouncementBarCount,
            decrementAnnouncementBarCount,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(AnnouncementBar);
