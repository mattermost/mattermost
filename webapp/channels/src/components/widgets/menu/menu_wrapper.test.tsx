// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallow} from 'enzyme';

import MenuWrapper from './menu_wrapper';

describe('components/MenuWrapper', () => {
    test('should match snapshot', () => {
        const wrapper = shallow(
            <MenuWrapper>
                <p>{'title'}</p>
                <p>{'menu'}</p>
            </MenuWrapper>,
        );

        expect(wrapper).toMatchInlineSnapshot(`
<div
  className="MenuWrapper "
  onClick={[Function]}
>
  <p>
    title
  </p>
  <MenuWrapperAnimation
    show={false}
  >
    <p>
      menu
    </p>
  </MenuWrapperAnimation>
</div>
`);
    });

    test('should match snapshot with state false', () => {
        const wrapper = shallow(
            <MenuWrapper>
                <p>{'title'}</p>
                <p>{'menu'}</p>
            </MenuWrapper>,
        );
        wrapper.setState({open: true});
        expect(wrapper).toMatchInlineSnapshot(`
<div
  className="MenuWrapper  MenuWrapper--open"
  onClick={[Function]}
>
  <p>
    title
  </p>
  <MenuWrapperAnimation
    show={true}
  >
    <p>
      menu
    </p>
  </MenuWrapperAnimation>
</div>
`);
    });

    test('should toggle the state on click', () => {
        const wrapper = shallow(
            <MenuWrapper>
                <p>{'title'}</p>
                <p>{'menu'}</p>
            </MenuWrapper>,
        );
        expect(wrapper.state('open')).toBe(false);
        wrapper.simulate('click', {preventDefault: jest.fn(), stopPropagation: jest.fn()});
        expect(wrapper.state('open')).toBe(true);
        wrapper.simulate('click', {preventDefault: jest.fn(), stopPropagation: jest.fn()});
        expect(wrapper.state('open')).toBe(false);
    });

    test('should raise an exception on more or less than 2 children', () => {
        expect(() => {
            shallow(<MenuWrapper/>);
        }).toThrow();
        expect(() => {
            shallow(
                <MenuWrapper>
                    <p>{'title'}</p>
                </MenuWrapper>,
            );
        }).toThrow();
        expect(() => {
            shallow(
                <MenuWrapper>
                    <p>{'title1'}</p>
                    <p>{'title2'}</p>
                    <p>{'title3'}</p>
                </MenuWrapper>,
            );
        }).toThrow();
    });
    test('should stop propogation and prevent default when toggled and prop is enabled', () => {
        const wrapper = shallow<MenuWrapper>(
            <MenuWrapper stopPropagationOnToggle={true}>
                <p>{'title'}</p>
                <p>{'menu'}</p>
            </MenuWrapper>,
        );
        const event: any = {stopPropagation: jest.fn(), preventDefault: jest.fn()};
        wrapper.instance().toggle(event);

        expect(event.preventDefault).toHaveBeenCalled();
        expect(event.stopPropagation).toHaveBeenCalled();
    });
    test('should call the onToggle callback when toggled', () => {
        const onToggle = jest.fn();
        const wrapper = shallow<MenuWrapper>(
            <MenuWrapper onToggle={onToggle}>
                <p>{'title'}</p>
                <p>{'menu'}</p>
            </MenuWrapper>,
        );
        const event: any = {stopPropagation: jest.fn(), preventDefault: jest.fn()};
        wrapper.instance().toggle(event);

        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(event.stopPropagation).not.toHaveBeenCalled();
        expect(onToggle).toHaveBeenCalledWith(wrapper.instance().state.open);
    });
    test('should initialize state from props if prop is given', () => {
        const wrapper = shallow<MenuWrapper>(
            <MenuWrapper open={true}>
                <p>{'title'}</p>
                <p>{'menu'}</p>
            </MenuWrapper>,
        );

        expect(wrapper.state('open')).toBe(true);
    });
});
