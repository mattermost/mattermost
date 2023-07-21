// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {getCurrentLocale} from 'selectors/i18n';

import {GlobalState} from 'types/store';

import TextboxLinks from './textbox_links';

function mapStateToProps(state: GlobalState) {
    return ({
        currentLocale: getCurrentLocale(state),
    });
}

export default connect(mapStateToProps)(TextboxLinks);
