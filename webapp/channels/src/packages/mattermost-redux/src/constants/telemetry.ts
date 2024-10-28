// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// SKUs
export const TrackProfessionalSKU = 'professional';
export const TrackEnterpriseSKU = 'enterprise';

// Features
export const TrackGroupsFeature = 'custom_groups';
export const TrackPassiveKeywordsFeature = 'passive_keywords';

// Events
export const TrackInviteGroupEvent = 'invite_group_to_channel__add_member';
export const TrackPassiveKeywordsEvent = 'update_passive_keywords';

// Categories
export const TrackActionCategory = 'action';
export const TrackMiscCategory = 'miscellaneous';

export const eventSKUs: {[event: string]: string[]} = {
    [TrackInviteGroupEvent]: [TrackProfessionalSKU, TrackEnterpriseSKU],
    [TrackPassiveKeywordsEvent]: [TrackProfessionalSKU, TrackEnterpriseSKU],
};

export const eventCategory: {[event: string]: string} = {
    [TrackInviteGroupEvent]: TrackActionCategory,
    [TrackPassiveKeywordsEvent]: TrackActionCategory,
};
