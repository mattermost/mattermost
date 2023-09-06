// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

import LatexInline from './latex_inline';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);
    return {
        enableInlineLatex: config.EnableLatex === 'true' && config.EnableInlineLatex === 'true',
    };
}

export default connect(mapStateToProps)(LatexInline);
