// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent, waitForElementToBeRemoved} from '@testing-library/react';
import {shallow} from 'enzyme';
import React from 'react';
import {Modal} from 'react-bootstrap';

import {withIntl} from 'tests/helpers/intl-test-helper';
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

    test('should hide on modal body click', async () => {
        const view = render(withIntl(
            <SubMenuModal {...baseProps}/>,
        ));

        screen.getByText('Text A');
        screen.getByText('Text B');
        screen.getByText('Text C');

        fireEvent.click(view.getByTestId('SubMenuModalBody'));

        await waitForElementToBeRemoved(() => screen.getByText('Text A'));
        expect(screen.queryAllByText('Text B').length).toBe(0);
        expect(screen.queryAllByText('Text C').length).toBe(0);
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
