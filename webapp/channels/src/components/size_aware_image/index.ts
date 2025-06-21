// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {isGifAutoplayEnabled} from 'selectors/preferences';

import type {GlobalState} from 'types/store';

import SizeAwareImage from './size_aware_image';

function mapStateToProps(state: GlobalState) {
    return {
        gifAutoplayEnabled: isGifAutoplayEnabled(state),
    };
}

export default connect(mapStateToProps)(SizeAwareImage);
