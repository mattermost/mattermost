// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {GlobalState} from '@mattermost/types/store';

import {doPostActionWithCookie as doPostActionWithCookieThunk} from 'mattermost-redux/actions/posts';
import {getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';

import {openModal} from 'actions/views/modals';

import {applyIntegrationGotoLocation} from 'utils/integration_navigation';

import MessageAttachment from './message_attachment';

function mapStateToProps(state: GlobalState) {
    return {
        currentRelativeTeamUrl: getCurrentRelativeTeamUrl(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: {
            ...bindActionCreators({
                openModal,
            }, dispatch),
            doPostActionWithCookie: (
                postId: string,
                actionId: string,
                actionCookie: string,
                selectedOption?: string,
                query?: Record<string, string>,
            ) => dispatch(doPostActionWithCookieThunk(postId, actionId, actionCookie, selectedOption ?? '', query, 'attachment')).then((result) => {
                if (!result.error) {
                    applyIntegrationGotoLocation((result.data as {goto_location?: string} | undefined)?.goto_location);
                }
                return result;
            }),
        },
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(MessageAttachment);
