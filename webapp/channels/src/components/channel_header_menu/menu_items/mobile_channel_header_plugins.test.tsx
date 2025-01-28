// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch} from 'react-redux';

import {AppBindingLocations} from 'mattermost-redux/constants/apps';

import * as appsActions from 'actions/apps';
import * as channelActions from 'actions/views/channel';
import * as modalActions from 'actions/views/modals';

import {WithTestMenuContext} from 'components/menu/menu_context_test';

import {renderWithContext, screen, fireEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import MobileChannelHeaderPlugins from './mobile_channel_header_plugins';

describe('components/ChannelHeaderMenu/MenuItems/MobileChannelHeaderPlugins, with no extended components', () => {
    beforeEach(() => {
        jest.spyOn(modalActions, 'openModal');
        jest.spyOn(channelActions, 'leaveChannel');

        jest.spyOn(appsActions, 'handleBindingClick');
        jest.spyOn(appsActions, 'openAppsModal');
        jest.spyOn(appsActions, 'postEphemeralCallResponseForChannel');

        // Mock useDispatch to return our custom dispatch function
        jest.spyOn(require('react-redux'), 'useDispatch');
    });

    // afterEach(() => {
    //     jest.clearAllMocks();
    // });

    // test('renders the component correctly', () => {
    //     const channel = TestHelper.getChannelMock();

    //     renderWithContext(
    //         <WithTestMenuContext>
    //             <MobileChannelHeaderPlugins channel={channel}/>
    //         </WithTestMenuContext>, {},
    //     );
    //     expect(screen.getByRole('div')).toBeEmptyDOMElement();

    //     // fireEvent.click(menuItem); // Simulate click on the menu item
    //     // expect(useDispatch).toHaveBeenCalledTimes(1); // Ensure dispatch was called
    //     // expect(channelActions.leaveChannel).toHaveBeenCalledTimes(1); // Ensure dispatch was called
    //     // expect(channelActions.leaveChannel).toHaveBeenCalledWith(channel.id);
    // });

    // test('renders the component correctly, with one extended component', () => {
    //     const state = {
    //         plugins: {
    //             components: {
    //                 MobileChannelHeaderButton: [
    //                     {
    //                         id: 'someid',
    //                         pluginId: 'pluginid',
    //                         icon: <i className='fa fa-anchor'/>,
    //                         action: jest.fn(),
    //                         dropdownText: 'some dropdown text',
    //                     },
    //                 ],
    //             },
    //         },
    //     };

    //     const channel = TestHelper.getChannelMock();

    //     renderWithContext(
    //         <WithTestMenuContext>
    //             <MobileChannelHeaderPlugins channel={channel}/>
    //         </WithTestMenuContext>, state,
    //     );

    //     const menuItem = screen.getByText('some dropdown text');
    //     expect(menuItem).toBeInTheDocument();
    // });

    // test('renders the component correctly, with two extended component', () => {
    //     const state = {
    //         plugins: {
    //             components: {
    //                 MobileChannelHeaderButton: [
    //                     {
    //                         id: 'someid',
    //                         pluginId: 'pluginid',
    //                         icon: <i className='fa fa-anchor'/>,
    //                         action: jest.fn(),
    //                         dropdownText: 'some dropdown text',
    //                     },
    //                     {
    //                         id: 'someid2',
    //                         pluginId: 'pluginid2',
    //                         icon: <i className='fa fa-anchor'/>,
    //                         action: jest.fn(),
    //                         dropdownText: 'some other dropdown text',
    //                     },
    //                 ],
    //             },
    //         },
    //     };

    //     const channel = TestHelper.getChannelMock({type: 'P'});

    //     renderWithContext(
    //         <WithTestMenuContext>
    //             <MobileChannelHeaderPlugins channel={channel}/>
    //         </WithTestMenuContext>, state,
    //     );
    //     const menuItem = screen.getByText('some dropdown text');
    //     expect(menuItem).toBeInTheDocument();
    //     const menuItem2 = screen.getByText('some other dropdown text');
    //     expect(menuItem2).toBeInTheDocument();

    //     screen.debug();
    // });

    test('renders the component correctly, with one extended binding', () => {
        const state = {
            entities: {
                apps: {
                    main: {
                        bindings: [
                            {
                                app_id: 'appid',
                                location: AppBindingLocations.CHANNEL_HEADER_ICON,
                                icon: 'http://test.com/icon.png',
                                label: 'Label',
                                hint: 'Hint',
                                bindings: [
                                    {
                                        app_id: 'app1',
                                        location: 'channel-header-1',
                                        label: 'App 1 Channel Header',
                                    },
                                    // {
                                    //     app_id: 'app2',
                                    //     location: 'channel-header-2',
                                    //     label: 'App 2 Channel Header',
                                    // },
                                ],
                            },
                        ],
                    },
                },
                general: {
                    config: {
                        FeatureFlagAppsEnabled: 'true',
                    },
                },
            },
        };

        const channel = TestHelper.getChannelMock();

        renderWithContext(
            <WithTestMenuContext>
                <MobileChannelHeaderPlugins
                    channel={channel}
                    isDropdown={true}
                />
            </WithTestMenuContext>, state,
        );

        const menuItem = screen.getByText('App 1 Channel Header');
        expect(menuItem).toBeInTheDocument();
        fireEvent.click(menuItem);
        expect(useDispatch).toHaveBeenCalledTimes(1); // Ensure dispatch was called

        expect(appsActions.handleBindingClick).toHaveBeenCalledTimes(1);

        // expect(appsActions.handleBindingClick).toBeCalledWith(state.bin, context, expect.anything());

        //         const context = createCallContext(
        //             testBinding.app_id,
        //             testBinding.location,
        //             channel.id,
        //             channel.team_id,
        //         );

        //         wrapper.instance().fireAppAction(testBinding);
        //         expect(handleBindingClick).toHaveBeenCalledTimes(1);
        //         expect(handleBindingClick).toBeCalledWith(testBinding, context, expect.anything());

        // const menuItem2 = screen.getByText('App 2 Channel Header');
        // expect(menuItem2).toBeInTheDocument();
    });

    // test('renders the component correctly, with two bindings', () => {
    //     const state = {
    //         plugins: {
    //             components: {
    //                 MobileChannelHeaderButton: [
    //                     {
    //                         id: 'someid',
    //                         pluginId: 'pluginid',
    //                         icon: <i className='fa fa-anchor'/>,
    //                         action: jest.fn(),
    //                         dropdownText: 'some dropdown text',
    //                     },
    //                     {
    //                         id: 'someid2',
    //                         pluginId: 'pluginid2',
    //                         icon: <i className='fa fa-anchor'/>,
    //                         action: jest.fn(),
    //                         dropdownText: 'some other dropdown text',
    //                     },
    //                 ],
    //             },
    //         },
    //     };

    //     const channel = TestHelper.getChannelMock({type: 'P'});

    //     renderWithContext(
    //         <WithTestMenuContext>
    //             <MobileChannelHeaderPlugins channel={channel}/>
    //         </WithTestMenuContext>, state,
    //     );
    //     const menuItem = screen.getByText('some dropdown text');
    //     expect(menuItem).toBeInTheDocument();
    //     const menuItem2 = screen.getByText('some other dropdown text');
    //     expect(menuItem2).toBeInTheDocument();

    //     screen.debug();
    // });
});

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// import {mount} from 'enzyme';
// import React from 'react';

// import type {Channel, ChannelMembership} from '@mattermost/types/channels';

// import {AppCallResponseTypes} from 'mattermost-redux/constants/apps';
// import type {Theme} from 'mattermost-redux/selectors/entities/preferences';

// import MobileChannelHeaderPlug, {RawMobileChannelHeaderPlug} from 'plugins/mobile_channel_header_plug/mobile_channel_header_plug';
// import {mountWithIntl} from 'tests/helpers/intl-test-helper';
// import {createCallContext} from 'utils/apps';

// describe('plugins/MobileChannelHeaderPlug', () => {

//     const testChannel = {} as Channel;
//     const testChannelMember = {} as ChannelMembership;
//     const testTheme = {} as Theme;
//     const intl = {
//         formatMessage: (message: {id: string; defaultMessage: string}) => {
//             return message.defaultMessage;
//         },
//     } as any;


//     test('should match snapshot with one extended component', () => {
//         const wrapper = mount<RawMobileChannelHeaderPlug>(
//             <RawMobileChannelHeaderPlug
//                 components={[testPlug]}
//                 channel={testChannel}
//                 channelMember={testChannelMember}
//                 theme={testTheme}
//                 isDropdown={false}
//                 appsEnabled={false}
//                 appBindings={[]}
//                 actions={{
//                     handleBindingClick: jest.fn(),
//                     postEphemeralCallResponseForChannel: jest.fn(),
//                     openAppsModal: jest.fn(),
//                 }}
//                 intl={intl}
//             />,
//         );
//         expect(wrapper).toMatchSnapshot();

//         // Render a single list item containing a button
//         expect(wrapper.find('li')).toHaveLength(1);
//         expect(wrapper.find('button')).toHaveLength(1);

//         wrapper.instance().fireAction = jest.fn();
//         wrapper.find('button').first().simulate('click');
//         expect(wrapper.instance().fireAction).toHaveBeenCalledTimes(1);
//         expect(wrapper.instance().fireAction).toBeCalledWith(testPlug);
//     });

//     test('should match snapshot with two extended components', () => {
//         const wrapper = mountWithIntl(
//             <MobileChannelHeaderPlug
//                 components={[testPlug, {...testPlug, id: 'someid2'}]}
//                 channel={testChannel}
//                 channelMember={testChannelMember}
//                 theme={testTheme}
//                 isDropdown={false}
//                 appsEnabled={false}
//                 appBindings={[]}
//                 actions={{
//                     handleBindingClick: jest.fn(),
//                     postEphemeralCallResponseForChannel: jest.fn(),
//                     openAppsModal: jest.fn(),
//                 }}
//             />,
//         );
//         expect(wrapper).toMatchSnapshot();

//         // Render nothing
//         expect(wrapper.find('li').exists()).toBe(false);
//     });

//     test('should match snapshot with no bindings', () => {
//         const wrapper = mountWithIntl(
//             <MobileChannelHeaderPlug
//                 components={[]}
//                 channel={testChannel}
//                 channelMember={testChannelMember}
//                 theme={testTheme}
//                 isDropdown={false}
//                 appsEnabled={true}
//                 appBindings={[]}
//                 actions={{
//                     handleBindingClick: jest.fn(),
//                     postEphemeralCallResponseForChannel: jest.fn(),
//                     openAppsModal: jest.fn(),
//                 }}
//             />,
//         );
//         expect(wrapper).toMatchSnapshot();

//         // Render nothing
//         expect(wrapper.find('li').exists()).toBe(false);
//     });

//     test('should match snapshot with one binding', () => {
//         const wrapper = mount<RawMobileChannelHeaderPlug>(
//             <RawMobileChannelHeaderPlug
//                 components={[]}
//                 channel={testChannel}
//                 channelMember={testChannelMember}
//                 theme={testTheme}
//                 isDropdown={false}
//                 appsEnabled={true}
//                 appBindings={[testBinding]}
//                 actions={{
//                     handleBindingClick: jest.fn(),
//                     postEphemeralCallResponseForChannel: jest.fn(),
//                     openAppsModal: jest.fn(),
//                 }}
//                 intl={intl}
//             />,
//         );
//         expect(wrapper).toMatchSnapshot();

//         // Render a single list item containing a button
//         expect(wrapper.find('li')).toHaveLength(1);
//         expect(wrapper.find('button')).toHaveLength(1);

//         wrapper.instance().fireAppAction = jest.fn();
//         wrapper.find('button').first().simulate('click');
//         expect(wrapper.instance().fireAppAction).toHaveBeenCalledTimes(1);
//         expect(wrapper.instance().fireAppAction).toBeCalledWith(testBinding);
//     });

//     test('should match snapshot with two bindings', () => {
//         const wrapper = mountWithIntl(
//             <MobileChannelHeaderPlug
//                 components={[]}
//                 channel={testChannel}
//                 channelMember={testChannelMember}
//                 theme={testTheme}
//                 isDropdown={false}
//                 appsEnabled={false}
//                 appBindings={[testBinding, {...testBinding, app_id: 'app2'}]}
//                 actions={{
//                     handleBindingClick: jest.fn(),
//                     postEphemeralCallResponseForChannel: jest.fn(),
//                     openAppsModal: jest.fn(),
//                 }}
//             />,
//         );
//         expect(wrapper).toMatchSnapshot();

//         // Render nothing
//         expect(wrapper.find('li').exists()).toBe(false);
//     });

//     test('should match snapshot with one extended components and one binding', () => {
//         const wrapper = mountWithIntl(
//             <MobileChannelHeaderPlug
//                 components={[testPlug]}
//                 channel={testChannel}
//                 channelMember={testChannelMember}
//                 theme={testTheme}
//                 isDropdown={false}
//                 appsEnabled={true}
//                 appBindings={[testBinding]}
//                 actions={{
//                     handleBindingClick: jest.fn(),
//                     postEphemeralCallResponseForChannel: jest.fn(),
//                     openAppsModal: jest.fn(),
//                 }}
//             />,
//         );
//         expect(wrapper).toMatchSnapshot();

//         // Render nothing
//         expect(wrapper.find('li').exists()).toBe(false);
//     });

//     test('should match snapshot with no extended component, in dropdown', () => {
//         const wrapper = mountWithIntl(
//             <MobileChannelHeaderPlug
//                 components={[]}
//                 channel={testChannel}
//                 channelMember={testChannelMember}
//                 theme={testTheme}
//                 isDropdown={true}
//                 appsEnabled={false}
//                 appBindings={[]}
//                 actions={{
//                     handleBindingClick: jest.fn(),
//                     postEphemeralCallResponseForChannel: jest.fn(),
//                     openAppsModal: jest.fn(),
//                 }}
//             />,
//         );
//         expect(wrapper).toMatchSnapshot();

//         // Render nothing
//         expect(wrapper.find('li').exists()).toBe(false);
//     });

//     test('should match snapshot with one extended component, in dropdown', () => {
//         const wrapper = mountWithIntl(
//             <MobileChannelHeaderPlug
//                 components={[testPlug]}
//                 channel={testChannel}
//                 channelMember={testChannelMember}
//                 theme={testTheme}
//                 isDropdown={true}
//                 appsEnabled={false}
//                 appBindings={[]}
//                 actions={{
//                     handleBindingClick: jest.fn(),
//                     postEphemeralCallResponseForChannel: jest.fn(),
//                     openAppsModal: jest.fn(),
//                 }}
//             />,
//         );
//         expect(wrapper).toMatchSnapshot();

//         // Render a single list item containing an anchor
//         expect(wrapper.find('li')).toHaveLength(1);
//         expect(wrapper.find('a')).toHaveLength(1);
//     });

//     test('should match snapshot with two extended components, in dropdown', () => {
//         const wrapper = mount<RawMobileChannelHeaderPlug>(
//             <RawMobileChannelHeaderPlug
//                 components={[testPlug, {...testPlug, id: 'someid2'}]}
//                 channel={testChannel}
//                 channelMember={testChannelMember}
//                 theme={testTheme}
//                 isDropdown={true}
//                 appsEnabled={false}
//                 appBindings={[]}
//                 actions={{
//                     handleBindingClick: jest.fn(),
//                     postEphemeralCallResponseForChannel: jest.fn(),
//                     openAppsModal: jest.fn(),
//                 }}
//                 intl={intl}
//             />,
//         );
//         expect(wrapper).toMatchSnapshot();

//         // Render a two list items containing anchors
//         expect(wrapper.find('li')).toHaveLength(2);
//         expect(wrapper.find('a')).toHaveLength(2);

//         const instance = wrapper.instance();
//         instance.fireAction = jest.fn();

//         wrapper.find('a').first().simulate('click');
//         expect(instance.fireAction).toHaveBeenCalledTimes(1);
//         expect(instance.fireAction).toBeCalledWith(testPlug);
//     });

//     test('should match snapshot with no binding, in dropdown', () => {
//         const wrapper = mountWithIntl(
//             <MobileChannelHeaderPlug
//                 components={[]}
//                 channel={testChannel}
//                 channelMember={testChannelMember}
//                 theme={testTheme}
//                 isDropdown={true}
//                 appsEnabled={true}
//                 appBindings={[]}
//                 actions={{
//                     handleBindingClick: jest.fn(),
//                     postEphemeralCallResponseForChannel: jest.fn(),
//                     openAppsModal: jest.fn(),
//                 }}
//             />,
//         );
//         expect(wrapper).toMatchSnapshot();

//         // Render nothing
//         expect(wrapper.find('li').exists()).toBe(false);
//     });

//     test('should match snapshot with one binding, in dropdown', () => {
//         const wrapper = mountWithIntl(
//             <MobileChannelHeaderPlug
//                 components={[]}
//                 channel={testChannel}
//                 channelMember={testChannelMember}
//                 theme={testTheme}
//                 isDropdown={true}
//                 appsEnabled={true}
//                 appBindings={[testBinding]}
//                 actions={{
//                     handleBindingClick: jest.fn(),
//                     postEphemeralCallResponseForChannel: jest.fn(),
//                     openAppsModal: jest.fn(),
//                 }}
//             />,
//         );
//         expect(wrapper).toMatchSnapshot();

//         // Render a single list item containing an anchor
//         expect(wrapper.find('li')).toHaveLength(1);
//         expect(wrapper.find('a')).toHaveLength(1);
//     });

//     test('should match snapshot with two bindings, in dropdown', () => {
//         const wrapper = mount<RawMobileChannelHeaderPlug>(
//             <RawMobileChannelHeaderPlug
//                 components={[]}
//                 channel={testChannel}
//                 channelMember={testChannelMember}
//                 theme={testTheme}
//                 isDropdown={true}
//                 appsEnabled={true}
//                 appBindings={[testBinding, {...testBinding, app_id: 'app2'}]}
//                 actions={{
//                     handleBindingClick: jest.fn(),
//                     postEphemeralCallResponseForChannel: jest.fn(),
//                     openAppsModal: jest.fn(),
//                 }}
//                 intl={intl}
//             />,
//         );
//         expect(wrapper).toMatchSnapshot();

//         // Render a two list items containing anchors
//         expect(wrapper.find('li')).toHaveLength(2);
//         expect(wrapper.find('a')).toHaveLength(2);

//         const instance = wrapper.instance();
//         instance.fireAppAction = jest.fn();

//         wrapper.find('a').first().simulate('click');
//         expect(instance.fireAppAction).toHaveBeenCalledTimes(1);
//         expect(instance.fireAppAction).toBeCalledWith(testBinding);
//     });

//     test('should match snapshot with one extended component and one binding, in dropdown', () => {
//         const wrapper = mountWithIntl(
//             <MobileChannelHeaderPlug
//                 components={[testPlug]}
//                 channel={testChannel}
//                 channelMember={testChannelMember}
//                 theme={testTheme}
//                 isDropdown={true}
//                 appsEnabled={true}
//                 appBindings={[testBinding]}
//                 actions={{
//                     handleBindingClick: jest.fn(),
//                     postEphemeralCallResponseForChannel: jest.fn(),
//                     openAppsModal: jest.fn(),
//                 }}
//             />,
//         );
//         expect(wrapper).toMatchSnapshot();

//         // Render a two list items containing anchors
//         expect(wrapper.find('li')).toHaveLength(2);
//         expect(wrapper.find('a')).toHaveLength(2);
//     });

//     test('should call plugin.action on fireAction', () => {
//         const channel = {id: 'channel_id'} as Channel;
//         const channelMember = {} as ChannelMembership;
//         const newTestPlug = {
//             id: 'someid',
//             pluginId: 'pluginid',
//             icon: <i className='fa fa-anchor'/>,
//             action: jest.fn(),
//             dropdownText: 'some dropdown text',
//         };

//         const wrapper = mount<RawMobileChannelHeaderPlug>(
//             <RawMobileChannelHeaderPlug
//                 components={[newTestPlug]}
//                 channel={channel}
//                 channelMember={channelMember}
//                 theme={testTheme}
//                 isDropdown={true}
//                 appsEnabled={false}
//                 appBindings={[]}
//                 actions={{
//                     handleBindingClick: jest.fn(),
//                     postEphemeralCallResponseForChannel: jest.fn(),
//                     openAppsModal: jest.fn(),
//                 }}
//                 intl={intl}
//             />,
//         );

//         wrapper.instance().fireAction(newTestPlug);
//         expect(newTestPlug.action).toHaveBeenCalledTimes(1);
//         expect(newTestPlug.action).toBeCalledWith(channel, channelMember);
//     });

//     test('should call handleBindingClick on fireAppAction', () => {
//         const channel = {id: 'channel_id'} as Channel;
//         const channelMember = {} as ChannelMembership;

//         const handleBindingClick = jest.fn().mockResolvedValue({data: {type: AppCallResponseTypes.OK}});

//         const wrapper = mount<RawMobileChannelHeaderPlug>(
//             <RawMobileChannelHeaderPlug
//                 components={[]}
//                 channel={channel}
//                 channelMember={channelMember}
//                 theme={testTheme}
//                 isDropdown={true}
//                 appsEnabled={true}
//                 appBindings={[testBinding]}
//                 actions={{
//                     handleBindingClick,
//                     postEphemeralCallResponseForChannel: jest.fn(),
//                     openAppsModal: jest.fn(),
//                 }}
//                 intl={intl}
//             />,
//         );

//         const context = createCallContext(
//             testBinding.app_id,
//             testBinding.location,
//             channel.id,
//             channel.team_id,
//         );

//         wrapper.instance().fireAppAction(testBinding);
//         expect(handleBindingClick).toHaveBeenCalledTimes(1);
//         expect(handleBindingClick).toBeCalledWith(testBinding, context, expect.anything());
//     });
// });
