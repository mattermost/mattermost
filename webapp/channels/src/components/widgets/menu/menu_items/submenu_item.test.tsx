// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {mount} from 'enzyme';
import React from 'react';

import Constants from 'utils/constants';

import SubMenuItem from './submenu_item';

describe('components/widgets/menu/menu_items/submenu_item', () => {
    test('empty subMenu should match snapshot', () => {
        const wrapper = mount(
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
        const wrapper = mount(
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
    test('test subMenu click triggers action', async () => {
        const action1 = jest.fn().mockReturnValueOnce('default');
        const action2 = jest.fn().mockReturnValueOnce('default');
        const action3 = jest.fn().mockReturnValueOnce('default');
        const wrapper = mount(
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
        wrapper.setState({show: true});
        wrapper.find('#Z').at(1).simulate('click');
        await expect(action1).toHaveBeenCalledTimes(1);
        wrapper.setState({show: true});
        wrapper.find('#A').at(1).simulate('click');
        await expect(action2).toHaveBeenCalledTimes(1);
        wrapper.setState({show: true});
        wrapper.find('#B').at(1).simulate('click');
        await expect(action3).toHaveBeenCalledTimes(1);
    });
    test('should show/hide submenu based on keyboard commands', () => {
        const wrapper = mount<SubMenuItem>(
            <SubMenuItem
                key={'_pluginmenuitem'}
                id={'1'}
                text={'test'}
                subMenu={[]}
                root={true}
                direction={'right'}
            />,
        );

        wrapper.instance().show = jest.fn();
        wrapper.instance().hide = jest.fn();

        wrapper.instance().handleKeyDown({keyCode: Constants.KeyCodes.ENTER[1]} as any);
        expect(wrapper.instance().show).toHaveBeenCalled();

        wrapper.instance().handleKeyDown({keyCode: Constants.KeyCodes.LEFT[1]} as any);
        expect(wrapper.instance().hide).toHaveBeenCalled();

        wrapper.instance().handleKeyDown({keyCode: Constants.KeyCodes.RIGHT[1]} as any);
        expect(wrapper.instance().show).toHaveBeenCalled();
    });
});
