// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';
import * as redux from 'react-redux';

import {LinkVariantIcon} from '@mattermost/compass-icons/components';

import WithTooltip from 'components/with_tooltip';

import * as Actions from './actions';
import {InlineEntityTypes} from './constants';

import InlineEntityLink from './index';

// Mock the actions
jest.mock('./actions', () => ({
    handleInlineEntityClick: jest.fn(),
}));

describe('InlineEntityLink', () => {
    const useDispatchMock = jest.spyOn(redux, 'useDispatch');
    const mockDispatch = jest.fn();

    beforeEach(() => {
        useDispatchMock.mockReturnValue(mockDispatch);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    const baseProps = {
        url: 'http://localhost:8065/team-name/pl/postid123?view=citation',
        text: 'Link Text',
        className: 'custom-class',
    };

    test('should render as a normal link if parsing fails', () => {
        const props = {
            ...baseProps,
            url: 'http://invalid-url.com',
        };

        const wrapper = shallow(<InlineEntityLink {...props}/>);

        expect(wrapper.find('a').prop('href')).toBe(props.url);
        expect(wrapper.find('a').prop('className')).toBe(props.className);
        expect(wrapper.text()).toBe(props.text);
        expect(wrapper.find(LinkVariantIcon).exists()).toBe(false);
    });

    test('should render as a Post link correctly', () => {
        const props = {
            ...baseProps,
            url: 'http://localhost:8065/team-name/pl/postid123?view=citation',
        };

        const wrapper = shallow(<InlineEntityLink {...props}/>);

        expect(wrapper.find(WithTooltip).prop('title')).toBe('Go to post');
        expect(wrapper.find('a').prop('href')).toBe(props.url);
        expect(wrapper.find('a').hasClass('inline-entity-link')).toBe(true);
        expect(wrapper.find('a').hasClass('custom-class')).toBe(true);
        expect(wrapper.find(LinkVariantIcon).exists()).toBe(true);
    });

    test('should render as a Channel link correctly', () => {
        const props = {
            ...baseProps,
            url: 'http://localhost:8065/team-name/channels/channel-name?view=citation',
        };

        const wrapper = shallow(<InlineEntityLink {...props}/>);

        expect(wrapper.find(WithTooltip).prop('title')).toBe('Go to channel');
        expect(wrapper.find('a').prop('href')).toBe(props.url);
        expect(wrapper.find('a').hasClass('inline-entity-link')).toBe(true);
        expect(wrapper.find(LinkVariantIcon).exists()).toBe(true);
    });

    test('should render as a Team link correctly', () => {
        const props = {
            ...baseProps,
            url: 'http://localhost:8065/team-name?view=citation',
        };

        const wrapper = shallow(<InlineEntityLink {...props}/>);

        expect(wrapper.find(WithTooltip).prop('title')).toBe('Go to team');
        expect(wrapper.find('a').prop('href')).toBe(props.url);
        expect(wrapper.find('a').hasClass('inline-entity-link')).toBe(true);
        expect(wrapper.find(LinkVariantIcon).exists()).toBe(true);
    });

    test('should handle click event and dispatch action', () => {
        const props = {
            ...baseProps,
            url: 'http://localhost:8065/team-name/pl/postid123?view=citation',
        };

        const wrapper = shallow(<InlineEntityLink {...props}/>);
        const mockEvent = {
            preventDefault: jest.fn(),
            stopPropagation: jest.fn(),
        };

        wrapper.find('a').simulate('click', mockEvent);

        expect(mockEvent.preventDefault).toHaveBeenCalled();
        expect(mockEvent.stopPropagation).toHaveBeenCalled();
        expect(Actions.handleInlineEntityClick).toHaveBeenCalledWith(
            InlineEntityTypes.POST,
            'postid123',
            'team-name',
            '',
        );
        expect(mockDispatch).toHaveBeenCalled();
    });
});
