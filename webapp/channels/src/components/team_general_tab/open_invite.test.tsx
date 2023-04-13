// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import OpenInvite from './open_invite';

describe('components/TeamSettings/OpenInvite', () => {
    const patchTeam = jest.fn().mockReturnValue({data: true});
    const onToggle = jest.fn().mockReturnValue({data: true});
    const defaultProps = {
        teamId: 'team_id',
        isActive: false,
        isGroupConstrained: false,
        allowOpenInvite: false,
        patchTeam,
        onToggle,
    };

    test('should match snapshot on non active without groupConstrained', () => {
        const props = {...defaultProps};

        const wrapper = shallow(<OpenInvite {...props}/>);

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot on non active allowing open invite', () => {
        const props = {...defaultProps, allowOpenInvite: true};

        const wrapper = shallow(<OpenInvite {...props}/>);

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot on non active with groupConstrained', () => {
        const props = {...defaultProps, isGroupConstrained: true};

        const wrapper = shallow(<OpenInvite {...props}/>);

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot on active without groupConstrained', () => {
        const props = {...defaultProps, isActive: true};

        const wrapper = shallow(<OpenInvite {...props}/>);

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot on active with groupConstrained', () => {
        const props = {...defaultProps, isActive: true, isGroupConstrained: true};

        const wrapper = shallow(<OpenInvite {...props}/>);

        expect(wrapper).toMatchSnapshot();
    });
});
