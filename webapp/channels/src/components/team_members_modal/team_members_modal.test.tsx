// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';
import {Modal} from 'react-bootstrap';

import {TestHelper} from 'utils/test_helper';

import TeamMembersModal from './team_members_modal';

describe('components/TeamMembersModal', () => {
    const baseProps = {
        currentTeam: TestHelper.getTeamMock({
            id: 'id',
            display_name: 'display name',
        }),
        onExited: jest.fn(),
        onLoad: jest.fn(),
        actions: {
            openModal: jest.fn(),
        },
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <TeamMembersModal
                {...baseProps}
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should call onHide on Modal\'s onExited', () => {
        const wrapper = shallow(
            <TeamMembersModal
                {...baseProps}
            />,
        );

        const modalProps = wrapper.find(Modal).first().props();
        if (modalProps.onExited) {
            modalProps.onExited(document.createElement('div'));
        }

        expect(baseProps.onExited).toHaveBeenCalledTimes(1);
    });
});
