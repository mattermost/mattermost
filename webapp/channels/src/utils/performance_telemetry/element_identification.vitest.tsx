// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {identifyElementRegion} from './element_identification';

describe('identifyElementRegion', () => {
    afterEach(() => {
        // Clean up any DOM elements created during tests
        document.body.innerHTML = '';
    });

    test('should identify post region from post__content class', () => {
        const container = document.createElement('div');
        container.className = 'post__content';
        const child = document.createElement('span');
        child.textContent = 'Post text';
        container.appendChild(child);
        document.body.appendChild(container);

        expect(identifyElementRegion(child)).toEqual('post');
    });

    test('should identify post_textbox region from create_post id', () => {
        const container = document.createElement('div');
        container.id = 'create_post';
        const textarea = document.createElement('textarea');
        container.appendChild(textarea);
        document.body.appendChild(container);

        expect(identifyElementRegion(textarea)).toEqual('post_textbox');
    });

    test('should identify channel_sidebar region from SidebarContainer class', () => {
        const sidebar = document.createElement('div');
        sidebar.className = 'SidebarContainer';
        const channelLink = document.createElement('a');
        channelLink.textContent = 'Test Channel';
        sidebar.appendChild(channelLink);
        document.body.appendChild(sidebar);

        expect(identifyElementRegion(channelLink)).toEqual('channel_sidebar');
    });

    test('should identify team_sidebar region from team-sidebar id', () => {
        const teamSidebar = document.createElement('div');
        teamSidebar.id = 'team-sidebar';
        const teamIcon = document.createElement('div');
        teamSidebar.appendChild(teamIcon);
        document.body.appendChild(teamSidebar);

        expect(identifyElementRegion(teamIcon)).toEqual('team_sidebar');
    });

    test('should identify channel_header region from channel-header class', () => {
        const header = document.createElement('div');
        header.className = 'channel-header';
        const headerText = document.createElement('span');
        headerText.textContent = 'Channel Header';
        header.appendChild(headerText);
        document.body.appendChild(header);

        expect(identifyElementRegion(headerText)).toEqual('channel_header');
    });

    test('should identify global_header region from global-header class', () => {
        const globalHeader = document.createElement('div');
        globalHeader.className = 'global-header';
        const searchBox = document.createElement('input');
        globalHeader.appendChild(searchBox);
        document.body.appendChild(globalHeader);

        expect(identifyElementRegion(searchBox)).toEqual('global_header');
    });

    test('should identify announcement_bar region from announcement-bar class', () => {
        const announcementBar = document.createElement('div');
        announcementBar.className = 'announcement-bar';
        const message = document.createElement('p');
        announcementBar.appendChild(message);
        document.body.appendChild(announcementBar);

        expect(identifyElementRegion(message)).toEqual('announcement_bar');
    });

    test('should identify center_channel region from channel_view id', () => {
        const channelView = document.createElement('div');
        channelView.id = 'channel_view';
        const content = document.createElement('div');
        channelView.appendChild(content);
        document.body.appendChild(channelView);

        expect(identifyElementRegion(content)).toEqual('center_channel');
    });

    test('should identify modal_content region from modal-content class', () => {
        const modal = document.createElement('div');
        modal.className = 'modal-content';
        const form = document.createElement('form');
        modal.appendChild(form);
        document.body.appendChild(modal);

        expect(identifyElementRegion(form)).toEqual('modal_content');
    });

    test('should return other for elements not in any identified region', () => {
        const orphanElement = document.createElement('div');
        document.body.appendChild(orphanElement);

        expect(identifyElementRegion(orphanElement)).toEqual('other');
    });

    test('should identify deepest matching region when nested', () => {
        // Create nested structure: channel_view > post__content > span
        const channelView = document.createElement('div');
        channelView.id = 'channel_view';

        const postContent = document.createElement('div');
        postContent.className = 'post__content';

        const postText = document.createElement('span');
        postText.textContent = 'Post message';

        postContent.appendChild(postText);
        channelView.appendChild(postContent);
        document.body.appendChild(channelView);

        // Should return 'post' (deepest) not 'center_channel'
        expect(identifyElementRegion(postText)).toEqual('post');
    });

    test('should identify region directly on element', () => {
        const sidebar = document.createElement('div');
        sidebar.className = 'SidebarContainer';
        document.body.appendChild(sidebar);

        expect(identifyElementRegion(sidebar)).toEqual('channel_sidebar');
    });
});
