// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {getIsMobileView} from 'selectors/views/browser';

import ListItem from './list_item';

import type {GlobalState} from 'types/store';

function mapStateToProps(state: GlobalState) {
    return {
        isMobileView: getIsMobileView(state),
    };
}

export default connect(mapStateToProps)(ListItem);
