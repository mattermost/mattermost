// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {GlobalState} from '@mattermost/types/store';

import Permissions from 'mattermost-redux/constants/permissions';
import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';
import {getAssociatedGroupsForReference} from 'mattermost-redux/selectors/entities/groups';
import {makeGetProfilesForThread} from 'mattermost-redux/selectors/entities/posts';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {autocompleteChannels} from 'actions/channel_actions';
import {autocompleteUsersInChannel} from 'actions/views/channel';
import {searchAssociatedGroupsForReference} from 'actions/views/group';

import Textbox from './textbox';
import TextboxLinks from './textbox_links';

type Props = {
    channelId: string;
    rootId?: string;
};

export type TextboxElement = HTMLInputElement | HTMLTextAreaElement;

const makeMapStateToProps = () => {
    const getProfilesForThread = makeGetProfilesForThread();
    return (state: GlobalState, ownProps: Props) => {
        const teamId = getCurrentTeamId(state);
        const license = getLicense(state);
        const useGroupMentions = license?.IsLicensed === 'true' && license?.LDAPGroups === 'true' && haveIChannelPermission(state,
            teamId,
            ownProps.channelId,
            Permissions.USE_GROUP_MENTIONS,
        );
        const autocompleteGroups = useGroupMentions ? getAssociatedGroupsForReference(state, teamId, ownProps.channelId) : null;

        return {
            currentUserId: getCurrentUserId(state),
            currentTeamId: teamId,
            autocompleteGroups,
            priorityProfiles: getProfilesForThread(state, ownProps.rootId ?? ''),
            delayChannelAutocomplete: getConfig(state).DelayChannelAutocomplete === 'true',
        };
    };
};

const mapDispatchToProps = (dispatch: Dispatch) => ({
    actions: bindActionCreators({
        autocompleteUsersInChannel,
        autocompleteChannels,
        searchAssociatedGroupsForReference,
    }, dispatch),
});

export {Textbox as TextboxClass};

export default connect(makeMapStateToProps, mapDispatchToProps, null, {forwardRef: true})(Textbox);
export {TextboxLinks};
