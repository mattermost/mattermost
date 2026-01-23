// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import {GenericModal} from '@mattermost/components';

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

        const modalProps = wrapper.find(GenericModal).first().props();
        if (modalProps.onExited) {
            modalProps.onExited();
        }

        expect(baseProps.onExited).toHaveBeenCalledTimes(1);
    });
});
