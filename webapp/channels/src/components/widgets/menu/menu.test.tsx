// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import Menu from './menu';

(global as any).MutationObserver = class {
    public disconnect() {}
    public observe() {}
};

jest.mock('utils/utils', () => {
    const original = jest.requireActual('utils/utils');
    return {
        ...original,
        isMobile: jest.fn(() => false),
    };
});

describe('components/Menu', () => {
    test('should match snapshot', () => {
        const wrapper = shallow(<Menu ariaLabel='test-label'>{'text'}</Menu>);

        expect(wrapper).toMatchInlineSnapshot(`
      <div
        aria-label="test-label"
        className="a11y__popup Menu"
        role="menu"
      >
        <ul
          className="Menu__content dropdown-menu"
          onClick={[Function]}
          style={Object {}}
        >
          text
        </ul>
      </div>
    `);
    });

    test('should match snapshot with id', () => {
        const wrapper = shallow(
            <Menu
                id='test-id'
                ariaLabel='test-label'
            >
                {'text'}
            </Menu>,
        );

        expect(wrapper).toMatchInlineSnapshot(`
      <div
        aria-label="test-label"
        className="a11y__popup Menu"
        id="test-id"
        role="menu"
      >
        <ul
          className="Menu__content dropdown-menu"
          onClick={[Function]}
          style={Object {}}
        >
          text
        </ul>
      </div>
    `);
    });

    test('should match snapshot with openLeft and openUp when is mobile', () => {
        const utils = require('utils/utils'); //eslint-disable-line global-require
        utils.isMobile.mockReturnValue(true);

        const wrapper = shallow(
            <Menu
                openLeft={true}
                openUp={true}
                ariaLabel='test-label'
            >
                {'text'}
            </Menu>,
        );

        expect(wrapper).toMatchInlineSnapshot(`
      <div
        aria-label="test-label"
        className="a11y__popup Menu"
        role="menu"
      >
        <ul
          className="Menu__content dropdown-menu"
          onClick={[Function]}
          style={
            Object {
              "left": "inherit",
              "right": 0,
            }
          }
        >
          text
        </ul>
      </div>
    `);
    });

    test('should match snapshot with openLeft and openUp', () => {
        const utils = require('utils/utils'); //eslint-disable-line global-require
        utils.isMobile.mockReturnValue(false);

        const wrapper = shallow(
            <Menu
                openLeft={true}
                openUp={true}
                ariaLabel='test-label'
            >
                {'text'}
            </Menu>,
        );

        expect(wrapper).toMatchInlineSnapshot(`
      <div
        aria-label="test-label"
        className="a11y__popup Menu"
        role="menu"
      >
        <ul
          className="Menu__content dropdown-menu"
          onClick={[Function]}
          style={
            Object {
              "bottom": "100%",
              "left": "inherit",
              "right": 0,
              "top": "auto",
            }
          }
        >
          text
        </ul>
      </div>
    `);
    });

    test('should hide the correct dividers', () => {
        const utils = require('utils/utils'); //eslint-disable-line global-require
        utils.isMobile.mockReturnValue(false);
        const pseudoMenu = document.createElement('div');
        const listOfItems = [
            'menu-divider',
            'menu-divider',
            'menu-divider',
            'menu-divider',
            'other',
            'other',
            'menu-divider',
            'menu-divider',
            'other',
            'menu-divider',
            'menu-divider',
            'menu-divider',
            'other',
            'other',
            'other',
            'menu-divider',
            'menu-divider',
            'menu-divider',
            'menu-divider',
        ];
        for (const className of listOfItems) {
            const element = document.createElement('div');
            element.classList.add(className);
            pseudoMenu.append(element);
        }

        const wrapper = shallow<Menu>(<Menu ariaLabel='test-label'>{'text'}</Menu>);
        const instance = wrapper.instance();
        Object.assign(instance.node, {current: pseudoMenu});
        instance.hideUnneededDividers();

        expect(instance.node.current).toMatchInlineSnapshot(`
        <div>
          <div
            class="menu-divider"
            style="display: none;"
          />
          <div
            class="menu-divider"
            style="display: none;"
          />
          <div
            class="menu-divider"
            style="display: none;"
          />
          <div
            class="menu-divider"
            style="display: none;"
          />
          <div
            class="other"
          />
          <div
            class="other"
          />
          <div
            class="menu-divider"
            style="display: block;"
          />
          <div
            class="menu-divider"
            style="display: none;"
          />
          <div
            class="other"
          />
          <div
            class="menu-divider"
            style="display: block;"
          />
          <div
            class="menu-divider"
            style="display: none;"
          />
          <div
            class="menu-divider"
            style="display: none;"
          />
          <div
            class="other"
          />
          <div
            class="other"
          />
          <div
            class="other"
          />
          <div
            class="menu-divider"
            style="display: none;"
          />
          <div
            class="menu-divider"
            style="display: none;"
          />
          <div
            class="menu-divider"
            style="display: none;"
          />
          <div
            class="menu-divider"
            style="display: none;"
          />
        </div>
        `);
    });

    test('should hide the correct dividers on mobile', () => {
        const utils = require('utils/utils'); //eslint-disable-line global-require
        utils.isMobile.mockReturnValue(false);
        const pseudoMenu = document.createElement('div');
        const listOfItems = [
            'mobile-menu-divider',
            'mobile-menu-divider',
            'mobile-menu-divider',
            'mobile-menu-divider',
            'other',
            'other',
            'mobile-menu-divider',
            'mobile-menu-divider',
            'other',
            'mobile-menu-divider',
            'mobile-menu-divider',
            'mobile-menu-divider',
            'other',
            'other',
            'other',
            'mobile-menu-divider',
            'mobile-menu-divider',
            'mobile-menu-divider',
            'mobile-menu-divider',
        ];
        for (const className of listOfItems) {
            const element = document.createElement('div');
            element.classList.add(className);
            pseudoMenu.append(element);
        }

        const wrapper = shallow<Menu>(<Menu ariaLabel='test-label'>{'text'}</Menu>);
        const instance = wrapper.instance();
        Object.assign(instance.node, {current: pseudoMenu});
        instance.hideUnneededDividers();

        expect(instance.node.current).toMatchInlineSnapshot(`
        <div>
          <div
            class="mobile-menu-divider"
            style="display: none;"
          />
          <div
            class="mobile-menu-divider"
            style="display: none;"
          />
          <div
            class="mobile-menu-divider"
            style="display: none;"
          />
          <div
            class="mobile-menu-divider"
            style="display: none;"
          />
          <div
            class="other"
          />
          <div
            class="other"
          />
          <div
            class="mobile-menu-divider"
            style="display: block;"
          />
          <div
            class="mobile-menu-divider"
            style="display: none;"
          />
          <div
            class="other"
          />
          <div
            class="mobile-menu-divider"
            style="display: block;"
          />
          <div
            class="mobile-menu-divider"
            style="display: none;"
          />
          <div
            class="mobile-menu-divider"
            style="display: none;"
          />
          <div
            class="other"
          />
          <div
            class="other"
          />
          <div
            class="other"
          />
          <div
            class="mobile-menu-divider"
            style="display: none;"
          />
          <div
            class="mobile-menu-divider"
            style="display: none;"
          />
          <div
            class="mobile-menu-divider"
            style="display: none;"
          />
          <div
            class="mobile-menu-divider"
            style="display: none;"
          />
        </div>
        `);
    });
});
