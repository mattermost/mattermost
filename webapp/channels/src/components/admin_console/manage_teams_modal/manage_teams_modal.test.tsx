// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {act} from 'react-dom/test-utils';
import {IntlProvider} from 'react-intl';

import type {ReactWrapper} from 'enzyme';
import {mount, shallow} from 'enzyme';

import {General} from 'mattermost-redux/constants';

import ManageTeamsModal from 'components/admin_console/manage_teams_modal/manage_teams_modal';

import {TestHelper} from 'utils/test_helper';

import ManageTeamsDropdown from './manage_teams_dropdown';

describe('ManageTeamsModal', () => {
    const baseProps = {
        locale: General.DEFAULT_LOCALE,
        onModalDismissed: jest.fn(),
        show: true,
        user: TestHelper.getUserMock({
            id: 'currentUserId',
            last_picture_update: 1234,
            email: 'currentUser@test.com',
            roles: 'system_user',
            username: 'currentUsername',
        }),
        actions: {
            getTeamMembersForUser: jest.fn().mockReturnValue(Promise.resolve({data: []})),
            getTeamsForUser: jest.fn().mockReturnValue(Promise.resolve({data: []})),
            updateTeamMemberSchemeRoles: jest.fn(),
            removeUserFromTeam: jest.fn(),
        },
    };

    test('should match snapshot init', () => {
        const wrapper = shallow(<ManageTeamsModal {...baseProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should call api calls on mount', async () => {
        const intlProviderProps = {
            defaultLocale: 'en',
            locale: 'en',
            messages: {testId: 'Actual value'},
        };

        await act(async () => {
            mount(
                <IntlProvider {...intlProviderProps}>
                    <ManageTeamsModal {...baseProps}/>
                </IntlProvider>,
            );
        });

        expect(baseProps.actions.getTeamMembersForUser).toHaveBeenCalledTimes(1);
        expect(baseProps.actions.getTeamMembersForUser).toHaveBeenCalledWith(baseProps.user.id);
        expect(baseProps.actions.getTeamsForUser).toHaveBeenCalledTimes(1);
        expect(baseProps.actions.getTeamsForUser).toHaveBeenCalledWith(baseProps.user.id);
    });

    test('should save data in state from api calls', async () => {
        const mockTeamData = TestHelper.getTeamMock({
            id: '123test',
            name: 'testTeam',
            display_name: 'testTeam',
            delete_at: 0,
        });

        const getTeamMembersForUser = jest.fn().mockReturnValue(Promise.resolve({data: [{team_id: '123test'}]}));
        const getTeamsForUser = jest.fn().mockReturnValue(Promise.resolve({data: [mockTeamData]}));

        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                getTeamMembersForUser,
                getTeamsForUser,
            },
        };
        const intlProviderProps = {
            defaultLocale: 'en',
            locale: 'en',
            messages: {'test.value': 'Actual value'},
        };

        let wrapper: ReactWrapper<any>;
        await act(async () => {
            wrapper = mount(
                <IntlProvider {...intlProviderProps}>
                    <ManageTeamsModal {...props}/>
                </IntlProvider>,
            );
        });
        wrapper!.update();

        expect(wrapper!.find('.manage-teams__team-name').text()).toEqual(mockTeamData.display_name);
        expect(wrapper!.find(ManageTeamsDropdown).props().teamMember).toEqual({team_id: '123test'});
    });
});
