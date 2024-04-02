// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export function setLDAPTestSettings(config) {
    return {
        siteName: config.TeamSettings.SiteName,
        siteUrl: config.ServiceSettings.SiteURL,
        teamName: '',
        user: null,
    };
}

export function disableOnboardingTaskList(ldapLogin) {
    cy.apiLogin(ldapLogin).then(({user}) => {
        cy.apiSaveOnboardingTaskListPreference(user.id, 'onboarding_task_list_open', 'false');
        cy.apiSaveOnboardingTaskListPreference(user.id, 'onboarding_task_list_show', 'false');
        cy.apiSaveSkipStepsPreference(user.id, 'true');
    });
}

export function removeUserFromAllTeams(testUser) {
    cy.apiGetUsersByUsernames([testUser.username]).then((users) => {
        if (users.length > 0) {
            users.forEach((user) => {
                cy.apiGetTeamsForUser(user.id).then((teams) => {
                    teams.forEach((team) => {
                        cy.apiDeleteUserFromTeam(team.id, user.id);
                    });
                });
            });
        }
    });
}
