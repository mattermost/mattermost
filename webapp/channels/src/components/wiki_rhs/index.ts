// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {publishPage} from 'actions/pages';
import {getSelectedPageId, getWikiRhsMode, getWikiRhsWikiId} from 'selectors/wiki_rhs';

import type {GlobalState} from 'types/store';

import WikiRHS from './wiki_rhs';

function mapStateToProps(state: GlobalState) {
    return {
        pageId: getSelectedPageId(state),
        wikiId: getWikiRhsWikiId(state),
        mode: getWikiRhsMode(state),
    };
}

function mapDispatchToProps(dispatch: any) {
    return {
        actions: bindActionCreators({
            publishPage,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(WikiRHS);
