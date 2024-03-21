// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';
import {Modal} from 'react-bootstrap';

import {render, screen, userEvent} from 'tests/react_testing_utils';

import SubMenuModal from './submenu_modal';

jest.mock('../../is_mobile_view_hack', () => ({
    isMobile: jest.fn(() => false),
}));

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

        render(
            <SubMenuModal {...props}/>,
        );

        userEvent.click(screen.getByText('Text A'));
        expect(action1).toHaveBeenCalledTimes(1);

        userEvent.click(screen.getByText('Text B'));
        expect(action2).toHaveBeenCalledTimes(1);

        userEvent.click(screen.getByText('Text C'));
        expect(action3).toHaveBeenCalledTimes(1);
    });

    test('should have called props.onExited when Modal.onExited is called', () => {
        const wrapper = shallow(
            <SubMenuModal {...baseProps}/>,
        );

        wrapper.find(Modal).props().onExited!(document.createElement('div'));
        expect(baseProps.onExited).toHaveBeenCalledTimes(1);
    });
});
