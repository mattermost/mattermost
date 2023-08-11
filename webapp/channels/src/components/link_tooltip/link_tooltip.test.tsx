// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ReactPortal} from 'react';
import ReactDOM from 'react-dom';

import {shallow} from 'enzyme';

import LinkTooltip from 'components/link_tooltip/link_tooltip';

describe('components/link_tooltip/link_tooltip', () => {
    test('should match snapshot', () => {
        ReactDOM.createPortal = (node) => node as ReactPortal;
        const wrapper = shallow<LinkTooltip>(
            <LinkTooltip
                href={'www.test.com'}
                attributes={{
                    class: 'mention-highlight',
                    'data-hashtag': '#somehashtag',
                    'data-link': 'somelink',
                    'data-channel-mention': 'somechannel',
                }}
            >
                {'test title'}
            </LinkTooltip>,
        );

        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find('span').text()).toBe('test title');
    });

    test('should match snapshot with uncommon link structure', () => {
        ReactDOM.createPortal = (node) => node as ReactPortal;
        const wrapper = shallow<LinkTooltip>(
            <LinkTooltip
                href={'https://www.google.com'}
                attributes={{}}
            >
                <span className='codespan__pre-wrap'>
                    <code>{'foo'}</code>
                </span>
                {' and '}
                <span className='codespan__pre-wrap'>
                    <code>{'bar'}</code>
                </span>
            </LinkTooltip>,
        );

        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find('span').at(0).text()).toBe('foo and bar');
    });
});
