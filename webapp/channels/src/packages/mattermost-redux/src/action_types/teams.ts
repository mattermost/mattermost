// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import keyMirror from 'mattermost-redux/utils/key_mirror';

export default keyMirror({
    GET_TEAMS_REQUEST: null,
    GET_TEAMS_SUCCESS: null,
    GET_TEAMS_FAILURE: null,

    MY_TEAMS_REQUEST: null,
    MY_TEAMS_SUCCESS: null,
    MY_TEAMS_FAILURE: null,

    CREATE_TEAM_REQUEST: null,
    CREATE_TEAM_SUCCESS: null,
    CREATE_TEAM_FAILURE: null,

    GET_TEAM_MEMBERS_REQUEST: null,
    GET_TEAM_MEMBERS_SUCCESS: null,
    GET_TEAM_MEMBERS_FAILURE: null,

    JOIN_TEAM_REQUEST: null,
    JOIN_TEAM_SUCCESS: null,
    JOIN_TEAM_FAILURE: null,

    TEAM_INVITE_INFO_REQUEST: null,
    TEAM_INVITE_INFO_SUCCESS: null,
    TEAM_INVITE_INFO_FAILURE: null,

    ADD_TO_TEAM_FROM_INVITE_REQUEST: null,
    ADD_TO_TEAM_FROM_INVITE_SUCCESS: null,
    ADD_TO_TEAM_FROM_INVITE_FAILURE: null,

    CREATED_TEAM: null,
    SELECT_TEAM: null,
    UPDATED_TEAM: null,
    PATCHED_TEAM: null,
    REGENERATED_TEAM_INVITE_ID: null,
    RECEIVED_TEAM: null,
    RECEIVED_TEAMS: null,
    RECEIVED_TEAM_DELETED: null,
    RECEIVED_TEAM_UNARCHIVED: null,
    RECEIVED_TEAMS_LIST: null,
    RECEIVED_MY_TEAM_MEMBERS: null,
    RECEIVED_MY_TEAM_MEMBER: null,
    RECEIVED_TEAM_MEMBERS: null,
    RECEIVED_MEMBERS_IN_TEAM: null,
    RECEIVED_MEMBER_IN_TEAM: null,
    REMOVE_MEMBER_FROM_TEAM: null,
    RECEIVED_TEAM_STATS: null,
    RECEIVED_MY_TEAM_UNREADS: null,
    LEAVE_TEAM: null,
    UPDATED_TEAM_SCHEME: null,
    UPDATED_TEAM_MEMBER_SCHEME_ROLES: null,

    RECEIVED_TEAM_MEMBERS_MINUS_GROUP_MEMBERS: null,

    RECEIVED_TOTAL_TEAM_COUNT: null,
});
