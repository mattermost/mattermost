// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {bindActionCreators, Dispatch} from 'redux';
import {connect, ConnectedProps} from 'react-redux';

import {GenericAction} from 'mattermost-redux/types/actions';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

import {GlobalState} from 'types/store';

import {openModal} from 'actions/views/modals';

import UserGuideDropdown from './user_guide_dropdown';

function mapStateToProps(state: GlobalState) {
    const {HelpLink, ReportAProblemLink, EnableAskCommunityLink} = getConfig(state);
    return {
        helpLink: HelpLink!,
        reportAProblemLink: ReportAProblemLink!,
        enableAskCommunityLink: EnableAskCommunityLink!,
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators({
            openModal,
        }, dispatch),
    };
}

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(UserGuideDropdown);
