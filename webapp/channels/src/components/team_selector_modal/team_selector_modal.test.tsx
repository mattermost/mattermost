// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import {TestHelper} from 'utils/test_helper';

import TeamSelectorModal, {Props} from './team_selector_modal';

describe('components/TeamSelectorModal', () => {
    const defaultProps: Props = {
        currentSchemeId: 'xxx',
        alreadySelected: ['id1'],
        searchTerm: '',
        teams: [
            TestHelper.getTeamMock({
                id: 'id1',
                delete_at: 0,
                scheme_id: '',
                display_name: 'Team 1',
            }),
            TestHelper.getTeamMock({
                id: 'id2',
                delete_at: 123,
                scheme_id: '',
                display_name: 'Team 2',
            }),
            TestHelper.getTeamMock({
                id: 'id3',
                delete_at: 0,
                scheme_id: 'test',
                display_name: 'Team 3',
            }),
            TestHelper.getTeamMock({
                id: 'id4',
                delete_at: 0,
                scheme_id: '',
                display_name: 'Team 4',
                group_constrained: false,
            }),
            TestHelper.getTeamMock({
                id: 'id5',
                delete_at: 0,
                scheme_id: '',
                display_name: 'Team 5',
                group_constrained: true,
            }),
        ],
        onModalDismissed: jest.fn(),
        onTeamsSelected: jest.fn(),
        actions: {
            loadTeams: jest.fn().mockResolvedValue({data: []}),
            setModalSearchTerm: jest.fn(() => Promise.resolve()),
            searchTeams: jest.fn(() => Promise.resolve()),
        },
    };

    test('should match snapshot', () => {
        const wrapper = shallow(<TeamSelectorModal {...defaultProps}/>);

        expect(wrapper).toMatchSnapshot();
    });

    test('should hide group constrained teams when excludeGroupConstrained is true', () => {
        const wrapper = shallow(
            <TeamSelectorModal {...defaultProps}/>,
        );

        wrapper.setProps({excludeGroupConstrained: true});

        expect(wrapper).toMatchSnapshot();
    });
});
