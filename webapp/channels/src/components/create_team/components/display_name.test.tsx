// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import type {ReactWrapper} from 'enzyme';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import DisplayName from 'components/create_team/components/display_name';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import Constants from 'utils/constants';
import {cleanUpUrlable} from 'utils/url';

jest.mock('images/logo.png', () => 'logo.png');

describe('/components/create_team/components/display_name', () => {
    const defaultProps = {
        updateParent: jest.fn(),
        state: {
            team: {name: 'test-team', display_name: 'test-team'},
            wizard: 'display_name',
        },
        actions: {
            trackEvent: jest.fn(),
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

    test('should display isRequired error', () => {
        const wrapper = mountWithIntl(<DisplayName {...defaultProps}/>);
        (wrapper.find('.form-control') as unknown as ReactWrapper<any, any, HTMLInputElement>).instance().value = '';
        wrapper.find('.form-control').simulate('change');

        wrapper.find('button').simulate('click', {
            preventDefault: () => jest.fn(),
        });

        expect(wrapper.state('nameError')).toEqual(
            <FormattedMessage
                id='create_team.display_name.required'
                defaultMessage='This field is required'
            />,
        );
    });

    test('should display isRequired error for null team in props', () => {
        const nullTeamProps = {
            updateParent: jest.fn(),
            state: {
                wizard: 'display_name',
            },
            actions: {
                trackEvent: jest.fn(),
            },
        };

        const wrapper = mountWithIntl(<DisplayName {...nullTeamProps}/>);

        (wrapper.find('.form-control') as unknown as ReactWrapper<any, any, HTMLInputElement>).instance().value = '';
        wrapper.find('.form-control').simulate('change');

        wrapper.find('button').simulate('click', {
            preventDefault: () => jest.fn(),
        });

        expect(wrapper.state('nameError')).toEqual(
            <FormattedMessage
                id='create_team.display_name.required'
                defaultMessage='This field is required'
            />,
        );
    });

    test('should display isRequired error for empty team in props', () => {
        const nullTeamProps = {
            updateParent: jest.fn(),
            state: {
                team: {},
                wizard: 'display_name',
            },
            actions: {
                trackEvent: jest.fn(),
            },
        };

        const wrapper = mountWithIntl(<DisplayName {...nullTeamProps}/>);

        (wrapper.find('.form-control') as unknown as ReactWrapper<any, any, HTMLInputElement>).instance().value = '';
        wrapper.find('.form-control').simulate('change');

        wrapper.find('button').simulate('click', {
            preventDefault: () => jest.fn(),
        });

        expect(wrapper.state('nameError')).toEqual(
            <FormattedMessage
                id='create_team.display_name.required'
                defaultMessage='This field is required'
            />,
        );
    });

    test('should display charLength error', () => {
        const wrapper = mountWithIntl(<DisplayName {...defaultProps}/>);
        const input = (wrapper.find('.form-control') as unknown as ReactWrapper<any, any, HTMLInputElement>).instance();
        input.value = 'a'.repeat(Constants.MAX_TEAMNAME_LENGTH + 1);
        wrapper.find('.form-control').simulate('change');

        wrapper.find('button').simulate('click', {
            preventDefault: () => jest.fn(),
        });

        expect(wrapper.state('nameError')).toEqual(
            <FormattedMessage
                id='create_team.display_name.charLength'
                defaultMessage='Name must be {min} or more characters up to a maximum of {max}. You can add a longer team description later.'
                values={{
                    min: Constants.MIN_TEAMNAME_LENGTH,
                    max: Constants.MAX_TEAMNAME_LENGTH,
                }}
            />,
        );
    });
});
