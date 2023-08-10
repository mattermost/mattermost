// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {saveSearchScrollPosition} from 'mattermost-redux/actions/gifs';

import SearchGrid from './SearchGrid';

import type {GlobalState} from 'types/store';

function mapStateToProps(state: GlobalState) {
    return {
        ...state.entities.gifs.cache,
        ...state.entities.gifs.search,
        appProps: state.entities.gifs.app,
    };
}

const mapDispatchToProps = ({
    saveSearchScrollPosition,
});

export default connect(mapStateToProps, mapDispatchToProps)(SearchGrid);
