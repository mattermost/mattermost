// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import TeamGroupsManageModal from 'components/team_groups_manage_modal/team_groups_manage_modal';

import {TestHelper} from 'utils/test_helper';
import { shallowWithIntl } from 'tests/helpers/intl-test-helper';
import { any } from 'prop-types';

describe('components/TeamGroupsManageModal', () => {
    const team = TestHelper.getTeamMock({ type: 'O', allowed_domains: '', allow_open_invite: false, scheme_id: undefined });
    const actions = {
        getGroupsAssociatedToTeam: jest.fn(),
        closeModal: jest.fn(),
        openModal: jest.fn(),
        unlinkGroupSyncable: jest.fn(),
        patchGroupSyncable: jest.fn(),
        getMyTeamMembers: jest.fn(),
    };

    const baseProps = {
        intl: {
            formatMessage: jest.fn(),
        },
        team,
        actions
    };

    test('should match snapshot', () => {
        const wrapper = shallow(<TeamGroupsManageModal {...baseProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should hide confirm modal when team changes', () => {
        const wrapper = shallow(<TeamGroupsManageModal {...baseProps}/>);
        wrapper.setProps({team: TestHelper.getTeamMock({id: 'new'})});
        expect(wrapper).toMatchSnapshot();
    });
});
    