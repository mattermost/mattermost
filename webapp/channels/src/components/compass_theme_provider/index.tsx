// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect, ConnectedProps} from 'react-redux';

import CompassThemeProvider from './compass_theme_provider';
import {GlobalState} from 'types/store';
import {getNewUIEnabled} from 'mattermost-redux/selectors/entities/preferences';

function makeMapStateToProps() {
    return function mapStateToProps(state: GlobalState) {
        return {
            isNewUI: getNewUIEnabled(state),
        };
    };
}

const connector = connect(makeMapStateToProps, null);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(CompassThemeProvider);
