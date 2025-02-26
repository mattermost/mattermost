// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// SKUs
export const TrackProfessionalSKU = 'professional';
export const TrackEnterpriseSKU = 'enterprise';

// Features
export const TrackGroupsFeature = 'custom_groups';
export const TrackPassiveKeywordsFeature = 'passive_keywords';
export const TrackScheduledPostsFeature = 'scheduled_posts';
export const TrackCrossTeamSearchFeature = 'cross_team_search';

// Events
export const TrackInviteGroupEvent = 'invite_group_to_channel__add_member';
export const TrackPassiveKeywordsEvent = 'update_passive_keywords';
export const TrackCrossTeamSearchCurrentTeamEvent = 'cross_team_search__current_team';
export const TrackCrossTeamSearchDifferentTeamEvent = 'cross_team_search__different_team';
export const TrackCrossTeamSearchAllTeamsEvent = 'cross_team_search__all_teams';

// Categories
export const TrackActionCategory = 'action';
export const TrackMiscCategory = 'miscellaneous';

// Properties
export const TrackPropertyUser = 'user_actual_id';
export const TrackPropertyUserAgent = 'user_agent';

export const eventSKUs: {[event: string]: string[]} = {
    [TrackInviteGroupEvent]: [TrackProfessionalSKU, TrackEnterpriseSKU],
    [TrackPassiveKeywordsEvent]: [TrackProfessionalSKU, TrackEnterpriseSKU],
};

export const eventCategory: {[event: string]: string} = {
    [TrackInviteGroupEvent]: TrackActionCategory,
    [TrackPassiveKeywordsEvent]: TrackActionCategory,
    [TrackCrossTeamSearchAllTeamsEvent]: TrackActionCategory,
    [TrackCrossTeamSearchCurrentTeamEvent]: TrackActionCategory,
    [TrackCrossTeamSearchDifferentTeamEvent]: TrackActionCategory,
};
