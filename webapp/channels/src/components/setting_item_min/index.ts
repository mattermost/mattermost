// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {getIsMobileView} from 'selectors/views/browser';

import SettingItemMin from './setting_item_min';

import type {GlobalState} from 'types/store';

function mapStateToProps(state: GlobalState) {
    return {
        isMobileView: getIsMobileView(state),
    };
}

export default connect(mapStateToProps, null, null, {forwardRef: true})(SettingItemMin);
