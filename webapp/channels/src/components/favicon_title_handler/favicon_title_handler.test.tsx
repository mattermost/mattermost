// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ComponentProps} from 'react';
import {ShallowWrapper} from 'enzyme';

import {ChannelType} from '@mattermost/types/channels';
import {TeamType} from '@mattermost/types/teams';

import {shallowWithIntl} from 'tests/helpers/intl-test-helper';

import {Constants} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';
import {isChrome, isFirefox} from 'utils/user_agent';

import FaviconTitleHandler, {FaviconTitleHandlerClass} from 'components/favicon_title_handler/favicon_title_handler';

type Props = ComponentProps<typeof FaviconTitleHandlerClass>;

jest.mock('utils/user_agent', () => {
    const original = jest.requireActual('utils/user_agent');
    return {
        ...original,
        isFirefox: jest.fn().mockReturnValue(true),
        isChrome: jest.fn(),
    };
});

describe('components/FaviconTitleHandler', () => {
    const defaultProps = {
        unreadStatus: false,
        siteName: 'Test site',
        currentChannel: TestHelper.getChannelMock({
            id: 'c1',
            display_name: 'Public test 1',
            name: 'public-test-1',
            type: Constants.OPEN_CHANNEL as ChannelType,
        }),
        currentTeam: TestHelper.getTeamMock({
            id: 'team_id',
            name: 'test-team',
            display_name: 'Test team display name',
            description: 'Test team description',
            type: 'team-type' as TeamType,
        }),
        currentTeammate: null,
        inGlobalThreads: false,
        inDrafts: false,
        inActivityAndInsights: false,
    };

    test('set correctly the title when needed', () => {
        const wrapper = shallowWithIntl(
            <FaviconTitleHandler {...defaultProps}/>,
        ) as unknown as ShallowWrapper<Props, any, FaviconTitleHandlerClass>;
        const instance = wrapper.instance();
        instance.updateTitle();
        instance.componentDidUpdate = jest.fn();
        instance.render = jest.fn();
        expect(document.title).toBe('Public test 1 - Test team display name Test site');

        wrapper.setProps({
            siteName: undefined,
        });
        instance.updateTitle();
        expect(document.title).toBe('Public test 1 - Test team display name');

        wrapper.setProps({
            currentChannel: {id: '1', type: Constants.DM_CHANNEL} as Props['currentChannel'],
            currentTeammate: {display_name: 'teammate'} as Props['currentTeammate'],
        });
        instance.updateTitle();
        expect(document.title).toBe('teammate - Test team display name');

        wrapper.setProps({
            unreadStatus: 3,
        });
        instance.updateTitle();
        expect(document.title).toBe('(3) teammate - Test team display name');

        wrapper.setProps({
            currentChannel: {} as Props['currentChannel'],
            currentTeammate: {} as Props['currentTeammate']});
        instance.updateTitle();
        expect(document.title).toBe('Mattermost - Join a team');
    });

    test('should set correct title on mentions on safari', () => {
        // in safari browser, modification of favicon is not
        // supported, hence we need to show * in title on mentions
        (isFirefox as jest.Mock).mockImplementation(() => false);
        (isChrome as jest.Mock).mockImplementation(() => false);
        const wrapper = shallowWithIntl(
            <FaviconTitleHandler {...defaultProps}/>,
        ) as unknown as ShallowWrapper<Props, any, FaviconTitleHandlerClass>;
        const instance = wrapper.instance();

        wrapper.setProps({
            siteName: undefined,
        });
        wrapper.setProps({
            currentChannel: {id: '1', type: Constants.DM_CHANNEL} as Props['currentChannel'],
            currentTeammate: {display_name: 'teammate'} as Props['currentTeammate'],
        });
        wrapper.setProps({
            unreadStatus: 3,
        });
        instance.updateTitle();
        expect(document.title).toBe('(3) * teammate - Test team display name');
    });

    test('should display correct favicon', () => {
        const link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);

        const wrapper = shallowWithIntl(
            <FaviconTitleHandler {...defaultProps}/>,
        ) as unknown as ShallowWrapper<Props, any, FaviconTitleHandlerClass>;
        const instance = wrapper.instance();
        instance.updateFavicon = jest.fn();

        wrapper.setProps({
            unreadStatus: 3,
        });
        expect(instance.updateFavicon).lastCalledWith('Mention');

        wrapper.setProps({
            unreadStatus: true,
        });
        expect(instance.updateFavicon).lastCalledWith('Unread');

        wrapper.setProps({
            unreadStatus: false,
        });
        expect(instance.updateFavicon).lastCalledWith('None');
    });

    test('should display correct title when in drafts', () => {
        const wrapper = shallowWithIntl(
            <FaviconTitleHandler
                {...defaultProps}
                inDrafts={true}
                currentChannel={undefined}
                siteName={undefined}
            />,
        ) as unknown as ShallowWrapper<Props, any, FaviconTitleHandlerClass>;
        wrapper.instance().updateTitle();

        expect(document.title).toBe('Drafts - Test team display name');
    });
});
