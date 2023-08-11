// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import type {ConnectedProps} from 'react-redux';

import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {GlobalState} from '@mattermost/types/store';

import {getFilePublicLink} from 'mattermost-redux/actions/files';
import * as Selectors from 'mattermost-redux/selectors/entities/files';
import type {GenericAction} from 'mattermost-redux/types/actions';

import GetPublicLinkModal from './get_public_link_modal';

function mapStateToProps(state: GlobalState) {
    const filePublicLink: unknown = Selectors.getFilePublicLink(state)?.link;
    return {
        link: filePublicLink as string,
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators({
            getFilePublicLink,
        }, dispatch),
    };
}

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(GetPublicLinkModal);
