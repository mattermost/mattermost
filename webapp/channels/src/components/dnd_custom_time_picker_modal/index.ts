// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {connect} from 'react-redux';

import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {setStatus} from 'mattermost-redux/actions/users';
import {getTheme} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {getCurrentLocale} from 'selectors/i18n';

import {makeAsyncComponent} from 'components/async_load';

import type {GlobalState} from 'types/store';

const DndCustomTimePicker = makeAsyncComponent('DndCustomTimePicker', React.lazy(() => import('./dnd_custom_time_picker_modal')));

function mapStateToProps(state: GlobalState) {
    const userId = getCurrentUserId(state);
    const locale = getCurrentLocale(state);
    const theme = getTheme(state);

    return {
        userId,
        locale,
        theme,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            setStatus,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(DndCustomTimePicker);
