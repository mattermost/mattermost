// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {BrowserRouter as Router} from 'react-router-dom';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';

import TeamButton from './team_button';

describe('components/TeamSidebar/TeamButton', () => {
    const baseProps = {
        btnClass: '',
        url: '',
        displayName: '',
        tip: '',
        order: 0,
        showOrder: false,
        active: false,
        disabled: false,
        unread: false,
        mentions: 0,
        teamIconUrl: null,
        switchTeam: () => {},
        isDraggable: false,
        teamIndex: 0,
        teamId: '',
        isInProduct: false,
    };

    it('should show unread badge and set class when unread in channels', () => {
        const props = {
            ...baseProps,
            active: false,
            unread: true,
        };

        const wrapper = mountWithIntl(
            <Router>
                <TeamButton {...props}/>
            </Router>,
        );

        expect(wrapper.find('.unread-badge').exists()).toBe(true);
        expect(wrapper.find('.team-container.unread').exists()).toBe(true);
    });

    it('should hide unread badge and set no class when unread in a product', () => {
        const props = {
            ...baseProps,
            active: false,
            unread: true,
            isInProduct: true,
        };

        const wrapper = mountWithIntl(
            <Router>
                <TeamButton {...props}/>
            </Router>,
        );

        expect(wrapper.find('.unread-badge').exists()).toBe(false);
        expect(wrapper.find('.team-container.unread').exists()).toBe(false);
    });

    it('should show mentions badge and set class when mentions in channels', () => {
        const props = {
            ...baseProps,
            active: false,
            unread: true,
            mentions: 1,
        };

        const wrapper = mountWithIntl(
            <Router>
                <TeamButton {...props}/>
            </Router>,
        );

        expect(wrapper.find('.badge.badge-max-number').exists()).toBe(true);
        expect(wrapper.find('.team-container.unread').exists()).toBe(true);
    });

    it('should hide mentions badge and set no class when mentions in product', () => {
        const props = {
            ...baseProps,
            active: false,
            unread: true,
            mentions: 1,
            isInProduct: true,
        };

        const wrapper = mountWithIntl(
            <Router>
                <TeamButton {...props}/>
            </Router>,
        );

        expect(wrapper.find('.badge.badge-max-number').exists()).toBe(false);
        expect(wrapper.find('.team-container.unread').exists()).toBe(false);
    });
});
