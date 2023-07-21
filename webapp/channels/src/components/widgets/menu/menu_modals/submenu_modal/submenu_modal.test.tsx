// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow, mount} from 'enzyme';
import React from 'react';
import {Modal} from 'react-bootstrap';

import SubMenuModal from 'components/widgets/menu/menu_modals/submenu_modal/submenu_modal';

(global as any).MutationObserver = class {
    public disconnect() {}
    public observe() {}
};

describe('components/submenu_modal', () => {
    const action1 = jest.fn().mockReturnValueOnce('default');
    const action2 = jest.fn().mockReturnValueOnce('default');
    const action3 = jest.fn().mockReturnValueOnce('default');
    const baseProps = {
        elements: [
            {
                id: 'A',
                text: 'Text A',
                action: action1,
                direction: 'left' as any,
            },
            {
                id: 'B',
                text: 'Text B',
                action: action2,
                direction: 'left' as any,
                subMenu: [
                    {
                        id: 'C',
                        text: 'Text C',
                        action: action3,
                        direction: 'left' as any,
                    },
                ],
            },
        ],
        onExited: jest.fn(),
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <SubMenuModal {...baseProps}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match state when onHide is called', () => {
        const wrapper = shallow<SubMenuModal>(
            <SubMenuModal {...baseProps}/>,
        );

        wrapper.setState({show: true});
        wrapper.instance().onHide();
        expect(wrapper.state('show')).toEqual(false);
    });

    test('should have called click function when button is clicked', async () => {
        const props = {
            ...baseProps,
        };
        const wrapper = mount(
            <SubMenuModal {...props}/>,
        );

        wrapper.setState({show: true});
        await wrapper.find('#A').at(1).simulate('click');
        expect(action1).toHaveBeenCalledTimes(1);
        expect(wrapper.state('show')).toEqual(false);

        wrapper.setState({show: true});
        await wrapper.find('#B').at(1).simulate('click');
        expect(action2).toHaveBeenCalledTimes(1);
        expect(wrapper.state('show')).toEqual(false);

        wrapper.setState({show: true});
        await wrapper.find('#C').at(1).simulate('click');
        expect(action3).toHaveBeenCalledTimes(1);
        expect(wrapper.state('show')).toEqual(false);
    });

    test('should have called props.onExited when Modal.onExited is called', () => {
        const wrapper = shallow(
            <SubMenuModal {...baseProps}/>,
        );

        wrapper.find(Modal).props().onExited!(document.createElement('div'));
        expect(baseProps.onExited).toHaveBeenCalledTimes(1);
    });
});
