// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import TeamSettingsModal from 'components/team_settings_modal/team_settings_modal';

describe('components/team_settings_modal', () => {
    const baseProps = {
        isCloud: false,
        onExited: jest.fn(),
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <TeamSettingsModal
                {...baseProps}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should call onExited callback when the modal is hidden', () => {
        const wrapper = shallow(
            <TeamSettingsModal
                {...baseProps}
            />,
        );

        (wrapper.instance() as TeamSettingsModal).handleHidden();
        expect(baseProps.onExited).toHaveBeenCalledTimes(1);
    });
});

