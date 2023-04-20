// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import menuItem from './menu_item';

describe('components/MenuItem', () => {
    const TestComponent = menuItem(() => null);

    const defaultProps = {
        show: true,
        id: 'test-id',
        text: 'test-text',
        otherProp: 'extra-prop',
    };

    test('should match snapshot not shown', () => {
        const props = {...defaultProps, show: false};
        const wrapper = shallow(<TestComponent {...props}/>);

        expect(wrapper).toMatchInlineSnapshot('""');
    });

    test('should match snapshot shown with icon', () => {
        const props = {...defaultProps, icon: 'test-icon'};
        const wrapper = shallow(<TestComponent {...props}/>);

        expect(wrapper).toMatchInlineSnapshot(`
            <li
              className="MenuItem MenuItem--with-icon"
              id="test-id"
              role="menuitem"
            >
              <Component
                ariaLabel="test-text"
                otherProp="extra-prop"
                text={
                  <React.Fragment>
                    <span
                      className="icon"
                    >
                      test-icon
                    </span>
                    test-text
                  </React.Fragment>
                }
              />
            </li>
        `);
    });

    test('should match snapshot shown without icon', () => {
        const wrapper = shallow(<TestComponent {...defaultProps}/>);

        expect(wrapper).toMatchInlineSnapshot(`
            <li
              className="MenuItem"
              id="test-id"
              role="menuitem"
            >
              <Component
                ariaLabel="test-text"
                otherProp="extra-prop"
                text="test-text"
              />
            </li>
        `);
    });
});
