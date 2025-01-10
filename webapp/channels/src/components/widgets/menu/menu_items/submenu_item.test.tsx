// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import {screen, userEvent, renderWithContext} from 'tests/react_testing_utils';
import Constants from 'utils/constants';

import SubMenuItem, {SubMenuItem as SubMenuItemClass} from './submenu_item';

jest.mock('../is_mobile_view_hack', () => ({
    isMobile: jest.fn(() => false),
}));

describe('components/widgets/menu/menu_items/submenu_item', () => {
    test('empty subMenu should match snapshot', () => {
        const wrapper = mountWithIntl(
            <SubMenuItem
                key={'_pluginmenuitem'}
                id={'1'}
                text={'test'}
                subMenu={[]}
                action={jest.fn()}
                root={true}
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('present subMenu should match snapshot with submenu', () => {
        const wrapper = mountWithIntl(
            <SubMenuItem
                key={'_pluginmenuitem'}
                id={'1'}
                text={'test'}
                subMenu={[
                    {
                        id: 'A',
                        text: 'Test A',
                        direction: 'left',
                    },
                    {
                        id: 'B',
                        text: 'Test B',
                        direction: 'left',
                    },
                ]}
                action={jest.fn()}
                root={true}
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('test subMenu click triggers action', () => {
        const action1 = jest.fn();
        const action2 = jest.fn();
        const action3 = jest.fn();

        renderWithContext(
            <SubMenuItem
                key={'_pluginmenuitem'}
                id={'Z'}
                text={'test'}
                subMenu={[
                    {
                        id: 'A',
                        text: 'Test A',
                        action: action2,
                        direction: 'left',
                    },
                    {
                        id: 'B',
                        text: 'Test B',
                        action: action3,
                        direction: 'left',
                    },
                ]}
                action={action1}
                root={true}
            />,
        );

        userEvent.click(screen.getByText('test'));
        expect(action1).toHaveBeenCalledTimes(1);

        userEvent.click(screen.getByText('Test A'));
        expect(action2).toHaveBeenCalledTimes(1);

        userEvent.click(screen.getByText('Test B'));
        expect(action3).toHaveBeenCalledTimes(1);

        // Confirm that the parent's action wasn't called again when clicking on a child item
        expect(action1).toHaveBeenCalledTimes(1);
    });

    test('should show/hide submenu based on keyboard commands', () => {
        const wrapper = mountWithIntl(
            <SubMenuItem
                key={'_pluginmenuitem'}
                id={'1'}
                text={'test'}
                subMenu={[]}
                root={true}
                direction={'right'}
            />,
        );

        const instance = wrapper.find(SubMenuItemClass).instance() as SubMenuItemClass;

        instance.show = jest.fn();
        instance.hide = jest.fn();

        instance.handleKeyDown({keyCode: Constants.KeyCodes.ENTER[1]} as any);
        expect(instance.show).toHaveBeenCalled();

        instance.handleKeyDown({keyCode: Constants.KeyCodes.LEFT[1]} as any);
        expect(instance.hide).toHaveBeenCalled();

        instance.handleKeyDown({keyCode: Constants.KeyCodes.RIGHT[1]} as any);
        expect(instance.show).toHaveBeenCalled();
    });
});
