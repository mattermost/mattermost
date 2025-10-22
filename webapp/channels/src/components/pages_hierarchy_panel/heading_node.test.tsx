// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import type {Heading} from 'utils/page_outline';

import HeadingNode from './heading_node';

jest.mock('utils/page_outline', () => ({
    scrollToHeading: jest.fn(),
}));

const mockHistory = {
    push: jest.fn(),
};

jest.mock('react-router-dom', () => ({
    useHistory: () => mockHistory,
}));

jest.mock('react-redux', () => ({
    useSelector: (selector: any) => selector({
        entities: {
            channels: {
                currentChannelId: 'current-channel',
            },
        },
        views: {
            wiki: {
                currentPageId: 'current-page',
            },
        },
    }),
}));

// Mock window.location
delete (global as any).window.location;
(global as any).window = Object.create(window);
(global as any).window.location = {
    pathname: '/test-team/pl/page123',
};

describe('HeadingNode', () => {
    const baseProps = {
        heading: {
            id: 'heading-0',
            text: 'Test Heading',
            level: 1,
        } as Heading,
        pageId: 'page123',
        depth: 1,
        teamName: 'test-team',
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should render heading node with correct text', () => {
        const wrapper = shallow(<HeadingNode {...baseProps}/>);

        expect(wrapper.find('.HeadingNode__text').text()).toBe('Test Heading');
    });

    test('should render with correct icon', () => {
        const wrapper = shallow(<HeadingNode {...baseProps}/>);

        expect(wrapper.find('.icon-text-short').exists()).toBe(true);
    });

    test('should apply correct padding based on depth and level', () => {
        const wrapper = shallow(<HeadingNode {...baseProps}/>);

        const expectedPadding = ((baseProps.heading.level - 1) * 16) + 16;
        expect(wrapper.find('.HeadingNode').prop('style')).toEqual({
            paddingLeft: `${expectedPadding}px`,
        });
    });

    test('should apply correct padding for nested heading (depth=2, level=2)', () => {
        const props = {
            ...baseProps,
            heading: {...baseProps.heading, level: 2},
            depth: 2,
        };
        const wrapper = shallow(<HeadingNode {...props}/>);

        const expectedPadding = ((2 - 1) * 16) + 16;
        expect(wrapper.find('.HeadingNode').prop('style')).toEqual({
            paddingLeft: `${expectedPadding}px`,
        });
    });

    test('should have correct ARIA attributes', () => {
        const wrapper = shallow(<HeadingNode {...baseProps}/>);
        const button = wrapper.find('.HeadingNode__button');

        expect(button.prop('role')).toBe('treeitem');
        expect(button.prop('aria-level')).toBe(baseProps.heading.level);
    });

    test('should render different heading levels with correct ARIA levels', () => {
        const levels = [1, 2, 3];

        levels.forEach((level) => {
            const props = {
                ...baseProps,
                heading: {...baseProps.heading, level},
            };
            const wrapper = shallow(<HeadingNode {...props}/>);
            const button = wrapper.find('.HeadingNode__button');

            expect(button.prop('aria-level')).toBe(level);
        });
    });

    test('should render with correct class names', () => {
        const wrapper = shallow(<HeadingNode {...baseProps}/>);

        expect(wrapper.find('.HeadingNode').exists()).toBe(true);
        expect(wrapper.find('.HeadingNode__button').exists()).toBe(true);
        expect(wrapper.find('.HeadingNode__text').exists()).toBe(true);
    });

    test('should handle long heading text', () => {
        const longText = 'This is a very long heading text that should be handled properly without breaking the layout or causing issues';
        const props = {
            ...baseProps,
            heading: {...baseProps.heading, text: longText},
        };
        const wrapper = shallow(<HeadingNode {...props}/>);

        expect(wrapper.find('.HeadingNode__text').text()).toBe(longText);
    });

    test('should handle special characters in heading text', () => {
        const specialText = 'Heading with *markdown* **bold** and `code`';
        const props = {
            ...baseProps,
            heading: {...baseProps.heading, text: specialText},
        };
        const wrapper = shallow(<HeadingNode {...props}/>);

        expect(wrapper.find('.HeadingNode__text').text()).toBe(specialText);
    });
});
