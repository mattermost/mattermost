// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {get} from 'mattermost-redux/selectors/entities/preferences';
import {getIsRhsExpanded, getIsRhsOpen} from 'selectors/rhs';

import {GlobalState} from 'types/store';
import {Preferences} from 'utils/constants';

import ShowMore from './show_more';

function mapStateToProps(state: GlobalState) {
    return {
        isRHSExpanded: getIsRhsExpanded(state),
        isRHSOpen: getIsRhsOpen(state),
        compactDisplay: get(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.MESSAGE_DISPLAY, Preferences.MESSAGE_DISPLAY_DEFAULT) === Preferences.MESSAGE_DISPLAY_COMPACT,
    };
}

export default connect(mapStateToProps)(ShowMore);
