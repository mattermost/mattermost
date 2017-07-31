// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

export function getNavigationBlocked(state) {
    return state.views.admin.navigationBlock.blocked;
}

export function showNavigationPrompt(state) {
    return state.views.admin.navigationBlock.showNavigationPrompt;
}

export function getOnNavigationConfirmed(state) {
    return state.views.admin.navigationBlock.onNavigationConfirmed;
}