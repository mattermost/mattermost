// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * @id - plugin ID
 * @version - plugin version
 * @url - A URL where the plugin can be downloaded
 * @filename - Name of a plugin file which should be available at "e2e/cypress/tests/fixtures/[filename]"
 * upon manual download from the given URL. File is not to be included in the commit.
 *
 * Note:
 * 1. Only those with "@filename" field is required to have corresponding file at fixtures folder.
 * Download the plugin file from the given "@url" and save to "e2e/cypress/tests/fixtures/[@filename]".
 * 2. Plugin should typically install in test via URL, unless it is specifically required to upload
 * by file.
 */

export const agendaPlugin = {
    id: 'com.mattermost.agenda',
    version: '0.2.2',
    url: 'https://github.com/mattermost/mattermost-plugin-agenda/releases/download/v0.2.2/com.mattermost.agenda-0.2.2.tar.gz',
};

export const demoPlugin = {
    id: 'com.mattermost.demo-plugin',
    version: '0.9.0',
    url: 'https://github.com/mattermost/mattermost-plugin-demo/releases/download/v0.9.0/com.mattermost.demo-plugin-0.9.0.tar.gz',
    filename: 'com.mattermost.demo-plugin-0.9.0.tar.gz',
};

export const demoPluginOld = {
    id: 'com.mattermost.demo-plugin',
    version: '0.8.0',
    url: 'https://github.com/mattermost/mattermost-plugin-demo/releases/download/v0.8.0/com.mattermost.demo-plugin-0.8.0.tar.gz',
    filename: 'com.mattermost.demo-plugin-0.8.0.tar.gz',
};

export const drawPlugin = {
    id: 'com.mattermost.draw-plugin',
    version: '0.0.4',
    url: 'https://github.com/jespino/mattermost-plugin-draw/releases/download/v0.0.4/com.mattermost.draw-plugin-0.0.4.tar.gz',
};

export const githubPlugin = {
    id: 'github',
    version: '2.0.1',
    url: 'https://github.com/mattermost/mattermost-plugin-github/releases/download/v2.0.1/github-2.0.1.tar.gz',
};

export const githubPluginOld = {
    id: 'github',
    version: '1.0.0',
    url: 'https://github.com/mattermost/mattermost-plugin-github/releases/download/v1.0.0/github-1.0.0.tar.gz',
};

export const gitlabPlugin = {
    id: 'com.github.manland.mattermost-plugin-gitlab',
    version: '1.3.0',
    url: 'https://github.com/mattermost/mattermost-plugin-gitlab/releases/download/v1.3.0/com.github.manland.mattermost-plugin-gitlab-1.3.0.tar.gz',
    filename: 'com.github.manland.mattermost-plugin-gitlab-1.3.0.tar.gz',
};

export const jiraPlugin = {
    id: 'jira',
    version: '3.0.1',
    url: 'https://github.com/mattermost/mattermost-plugin-jira/releases/download/v3.0.1/jira-3.0.1.tar.gz',
};

export const matterpollPlugin = {
    id: 'com.github.matterpoll.matterpoll',
    version: '1.5.0',
    url: 'https://github.com/matterpoll/matterpoll/releases/download/v1.5.0/com.github.matterpoll.matterpoll-1.5.0.tar.gz',
};

export const testPlugin = {
    id: 'com.mattermost.test-plugin',
    version: '0.1.0',
    url: 'https://github.com/mattermost/mattermost-plugin-test/releases/download/v0.1.0/com.mattermost.test-plugin-0.1.0.tar.gz',
};
