// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect, ConnectedProps} from 'react-redux';

import {Dispatch} from 'redux';

import {GlobalState} from 'types/store';

import {getIsMobileView} from 'selectors/views/browser';

import EmojiPickerOverlay from './emoji_picker_overlay';

function mapStateToProps(state: GlobalState) {
    return {
        isMobileView: getIsMobileView(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {};
}

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(EmojiPickerOverlay);