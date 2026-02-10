// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {openModal} from 'actions/views/modals';

import SettingsButton from './settings_button';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            openModal,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(SettingsButton);

// Re-export other components for convenient importing
export {SavedButton} from './saved_button';
export {MentionsButton} from './mentions_button';
export {UtilitySection} from './utility_section';
