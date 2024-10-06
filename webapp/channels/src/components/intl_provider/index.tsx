// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {loadTranslations} from 'actions/views/root';
import {getCurrentLocale, getTranslations} from 'selectors/i18n';

import type {GlobalState} from 'types/store';

import IntlProvider from './intl_provider';

function mapStateToProps(state: GlobalState) {
    const locale = getCurrentLocale(state);

    return {
        locale,
        translations: getTranslations(state, locale),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            loadTranslations,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(IntlProvider);
