// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import type {ComponentProps} from 'react';
import React from 'react';

import RhsThread from 'components/rhs_thread';

import {TestHelper} from 'utils/test_helper';

import SidebarRight from './sidebar_right';

type Props = ComponentProps<typeof SidebarRight>;
function getBaseProps(): Props {
    const channel = TestHelper.getChannelMock();
    return {
        actions: {
            closeRightHandSide: jest.fn(),
            openAtPrevious: jest.fn(),
            openRHSSearch: jest.fn(),
            setRhsExpanded: jest.fn(),
            showChannelFiles: jest.fn(),
            showChannelInfo: jest.fn(),
            showPinnedPosts: jest.fn(),
            updateSearchTerms: jest.fn(),
        },
        channel,
        isChannelFiles: false,
        isChannelInfo: false,
        isChannelMembers: false,
        isExpanded: false,
        isOpen: false,
        isPinnedPosts: false,
        isPluginView: false,
        isPostEditHistory: false,
        isSuppressed: false,
        postCardVisible: false,
        postRightVisible: false,
        previousRhsState: '',
        productId: '',
        rhsChannel: channel,
        searchVisible: false,
        selectedPostCardId: '',
        selectedPostId: '',
        team: TestHelper.getTeamMock(),
        teamId: '',
    };
}
describe('pass from suppressed', () => {
    it('fromSuppressed is only passed when moving from suppressed state to non suppressed', () => {
        const props = getBaseProps();
        const wrapper = shallow(<SidebarRight {...props}/>);
        expect(wrapper.find(RhsThread)).toHaveLength(0);

        wrapper.setProps({isOpen: true, postRightVisible: true});
        expect(wrapper.find(RhsThread)).toHaveLength(1);
        expect(wrapper.find(RhsThread).props().fromSuppressed).toBeFalsy();

        wrapper.setProps({isSuppressed: true, isOpen: false});
        expect(wrapper.find(RhsThread)).toHaveLength(0);

        wrapper.setProps({isSuppressed: false, isOpen: true});
        expect(wrapper.find(RhsThread)).toHaveLength(1);
        expect(wrapper.find(RhsThread).props().fromSuppressed).toBeTruthy();

        wrapper.setProps({isOpen: false, postRightVisible: false});
        expect(wrapper.find(RhsThread)).toHaveLength(0);

        wrapper.setProps({isOpen: true, postRightVisible: true});
        expect(wrapper.find(RhsThread)).toHaveLength(1);
        expect(wrapper.find(RhsThread).props().fromSuppressed).toBeFalsy();
    });
});
