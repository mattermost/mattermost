// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import type {ReactWrapper} from 'enzyme';
import React from 'react';

import DisplayName from 'components/create_team/components/display_name';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import {cleanUpUrlable} from 'utils/url';

jest.mock('images/logo.png', () => 'logo.png');

describe('/components/create_team/components/display_name', () => {
    const defaultProps = {
        updateParent: jest.fn(),
        state: {
            team: {name: 'test-team', display_name: 'test-team'},
            wizard: 'display_name',
        },
    };

    test('should match snapshot', () => {
        const wrapper = shallow(<DisplayName {...defaultProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should run updateParent function', () => {
        const wrapper = mountWithIntl(<DisplayName {...defaultProps}/>);

        wrapper.find('button').simulate('click', {
            preventDefault: () => jest.fn(),
        });

        expect(wrapper.prop('updateParent')).toHaveBeenCalled();
    });

    test('should pass state to updateParent function', () => {
        const wrapper = mountWithIntl(<DisplayName {...defaultProps}/>);

        wrapper.find('button').simulate('click', {
            preventDefault: () => jest.fn(),
        });

        expect(wrapper.prop('updateParent')).toHaveBeenCalledWith(defaultProps.state);
    });

    test('should pass updated team name to updateParent function', () => {
        const wrapper = mountWithIntl(<DisplayName {...defaultProps}/>);
        const teamDisplayName = 'My Test Team';
        const newState = {
            ...defaultProps.state,
            team: {
                ...defaultProps.state.team,
                display_name: teamDisplayName,
                name: cleanUpUrlable(teamDisplayName),
            },
        };

        (wrapper.find('.form-control') as unknown as ReactWrapper<any, any, HTMLInputElement>).instance().value = teamDisplayName;
        wrapper.find('.form-control').simulate('change');

        wrapper.find('button').simulate('click', {
            preventDefault: () => jest.fn(),
        });

        expect(wrapper.prop('updateParent')).toHaveBeenCalledWith(defaultProps.state);
        expect(wrapper.prop('updateParent').mock.calls[0][0]).toEqual(newState);
    });
});
