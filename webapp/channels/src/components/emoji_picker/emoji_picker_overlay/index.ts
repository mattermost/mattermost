// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect, ConnectedProps} from 'react-redux';

import {getIsMobileView} from 'selectors/views/browser';

import {GlobalState} from 'types/store';

import EmojiPickerOverlay from './emoji_picker_overlay';

function mapStateToProps(state: GlobalState) {
    return {
        isMobileView: getIsMobileView(state),
    };
}

const connector = connect(mapStateToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(EmojiPickerOverlay);
