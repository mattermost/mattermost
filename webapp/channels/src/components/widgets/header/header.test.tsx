// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';

import {shallow} from 'enzyme';

import Header from './header';

describe('components/widgets/header', () => {
    const levels: Array<ComponentProps<typeof Header>['level']> = [1, 2, 3, 4, 5, 6];

    test('should match basic snapshot', () => {
        const wrapper = shallow(
            <Header
                level={1}
                heading={'Title'}
                subtitle='Subheading'
                right={(
                    <div>{'addons'}</div>
                )}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test.each(levels)(
        'should render heading level %p',
        (level) => {
            const wrapper = shallow(
                <Header
                    level={level}
                    heading={'Title'}
                />,
            );

            if (level === 0) {
                expect(wrapper.find(`h${level}`).exists()).toBe(false);
                expect(wrapper.find('div.left').containsMatchingElement(<>{'Title'}</>)).toBe(true);
            } else {
                expect(wrapper.find(`h${level}`).text()).toBe('Title');
            }
        },
    );

    test('should support subheadings', () => {
        const wrapper = shallow(
            <Header
                heading={<h2 className='custom-heading'>{'Test title'}</h2>}
                subtitle='Subheading'
            />,
        );
        expect(wrapper.find('div.left').containsMatchingElement(<p>{'Subheading'}</p>)).toBe(true);
    });

    test('should support custom heading', () => {
        const wrapper = shallow(
            <Header
                heading={<h2 className='custom-heading'>{'Test title'}</h2>}
            />,
        );
        expect(wrapper.find('h2.custom-heading').text()).toBe('Test title');
    });
});
