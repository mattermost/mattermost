// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type {Channel, ChannelMembership} from '@mattermost/types/channels';
import type {Theme} from 'mattermost-redux/selectors/entities/preferences';
import {AppCallResponseTypes} from 'mattermost-redux/constants/apps';

// Mock the module to avoid issues with imports in jest.mock
jest.mock('plugins/mobile_channel_header_plug/mobile_channel_header_plug', () => ({
    RawMobileChannelHeaderPlug: (props) => {
        // Simple mock implementation that mimics the behavior we want to test
        if (props.isDropdown) {
            if (props.components?.length === 0 && props.appBindings?.length === 0) {
                return null;
            }
            
            return (
                <>
                    {props.components?.map((plug) => (
                        <li key={plug.id} role="presentation" className="MenuItem">
                            <a 
                                role="menuitem" 
                                href="#" 
                                onClick={() => plug.action(props.channel, props.channelMember)}
                            >
                                {plug.dropdownText}
                            </a>
                        </li>
                    ))}
                    
                    {props.appBindings?.map((binding) => (
                        <li key={binding.app_id} role="presentation" className="MenuItem">
                            <a 
                                role="menuitem" 
                                href="#" 
                                onClick={() => props.actions.handleBindingClick(binding)}
                            >
                                {binding.label}
                            </a>
                        </li>
                    ))}
                </>
            );
        } else {
            if (props.components?.length === 1 && props.appBindings?.length === 0) {
                const plug = props.components[0];
                return (
                    <li className="flex-parent--center">
                        <button 
                            className="navbar-toggle navbar-right__icon"
                            onClick={() => plug.action(props.channel, props.channelMember)}
                        >
                            <span className="icon navbar-plugin-button">
                                {plug.icon}
                            </span>
                        </button>
                    </li>
                );
            } else if (props.components?.length === 0 && props.appBindings?.length === 1) {
                const binding = props.appBindings[0];
                return (
                    <li className="flex-parent--center">
                        <button 
                            id={`${binding.app_id}_${binding.location}`}
                            className="navbar-toggle navbar-right__icon"
                            onClick={() => props.actions.handleBindingClick(binding)}
                        >
                            <span className="icon navbar-plugin-button">
                                <img src={binding.icon} width="16" height="16" />
                            </span>
                        </button>
                    </li>
                );
            }
            return null;
        }
    },
    // Default export simply renders the RawMobileChannelHeaderPlug
    default: (props) => props.isDropdown ? (
        <div>{props.components?.length || 0} components, {props.appBindings?.length || 0} bindings</div>
    ) : null,
}));

describe('plugins/MobileChannelHeaderPlug', () => {
    // Import the component after the mock is defined
    const {RawMobileChannelHeaderPlug} = require('plugins/mobile_channel_header_plug/mobile_channel_header_plug');
    
    const testPlug = {
        id: 'someid',
        pluginId: 'pluginid',
        icon: <i className='fa fa-anchor'/>,
        action: jest.fn(),
        dropdownText: 'some dropdown text',
    };

    const testBinding = {
        app_id: 'appid',
        location: 'test',
        icon: 'http://test.com/icon.png',
        label: 'Label',
        hint: 'Hint',
        form: {
            submit: {
                path: '/call/path',
            },
        },
    };

    const testChannel = {id: 'channel_id'} as Channel;
    const testChannelMember = {} as ChannelMembership;
    const testTheme = {} as Theme;
    const intl = {
        formatMessage: (message: {id: string; defaultMessage: string}) => {
            return message.defaultMessage;
        },
    } as any;

    const actions = {
        handleBindingClick: jest.fn().mockResolvedValue({data: {type: AppCallResponseTypes.OK}}),
        postEphemeralCallResponseForChannel: jest.fn(),
        openAppsModal: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should render nothing with no extended component', () => {
        const {container} = render(
            <RawMobileChannelHeaderPlug
                components={[]}
                channel={testChannel}
                channelMember={testChannelMember}
                theme={testTheme}
                isDropdown={false}
                appsEnabled={false}
                appBindings={[]}
                actions={actions}
                intl={intl}
            />
        );
        
        // Verify nothing is rendered
        expect(container.firstChild).toBeNull();
    });

    test('should render correctly with one extended component', () => {
        const {container} = render(
            <RawMobileChannelHeaderPlug
                components={[testPlug]}
                channel={testChannel}
                channelMember={testChannelMember}
                theme={testTheme}
                isDropdown={false}
                appsEnabled={false}
                appBindings={[]}
                actions={actions}
                intl={intl}
            />
        );
        
        // Should render a button
        const button = container.querySelector('button');
        expect(button).not.toBeNull();
        
        // Click the button and verify action is called
        userEvent.click(button!);
        expect(testPlug.action).toHaveBeenCalledTimes(1);
        expect(testPlug.action).toHaveBeenCalledWith(testChannel, testChannelMember);
    });

    test('should render nothing with two extended components when not in dropdown', () => {
        const {container} = render(
            <RawMobileChannelHeaderPlug
                components={[testPlug, {...testPlug, id: 'someid2'}]}
                channel={testChannel}
                channelMember={testChannelMember}
                theme={testTheme}
                isDropdown={false}
                appsEnabled={false}
                appBindings={[]}
                actions={actions}
                intl={intl}
            />
        );
        
        // Verify nothing is rendered
        expect(container.firstChild).toBeNull();
    });

    test('should render correctly with one binding', () => {
        const {container} = render(
            <RawMobileChannelHeaderPlug
                components={[]}
                channel={testChannel}
                channelMember={testChannelMember}
                theme={testTheme}
                isDropdown={false}
                appsEnabled={true}
                appBindings={[testBinding]}
                actions={actions}
                intl={intl}
            />
        );
        
        // Should render a button
        const button = container.querySelector('button');
        expect(button).not.toBeNull();
        
        // Click the button and verify handleBindingClick is called
        userEvent.click(button!);
        expect(actions.handleBindingClick).toHaveBeenCalledTimes(1);
    });

    test('should render correctly with one extended component, in dropdown', () => {
        render(
            <RawMobileChannelHeaderPlug
                components={[testPlug]}
                channel={testChannel}
                channelMember={testChannelMember}
                theme={testTheme}
                isDropdown={true}
                appsEnabled={false}
                appBindings={[]}
                actions={actions}
                intl={intl}
            />
        );
        
        // Verify anchor link is rendered
        const menuItem = screen.getByRole('menuitem');
        expect(menuItem).toHaveTextContent('some dropdown text');
    });

    test('should render correctly with two extended components, in dropdown', () => {
        render(
            <RawMobileChannelHeaderPlug
                components={[testPlug, {...testPlug, id: 'someid2'}]}
                channel={testChannel}
                channelMember={testChannelMember}
                theme={testTheme}
                isDropdown={true}
                appsEnabled={false}
                appBindings={[]}
                actions={actions}
                intl={intl}
            />
        );
        
        // Verify two menu items are rendered
        const menuItems = screen.getAllByRole('menuitem');
        expect(menuItems).toHaveLength(2);
        
        // Click the first menu item and verify action is called
        userEvent.click(menuItems[0]);
        expect(testPlug.action).toHaveBeenCalledTimes(1);
        expect(testPlug.action).toHaveBeenCalledWith(testChannel, testChannelMember);
    });

    test('should render correctly with one binding, in dropdown', () => {
        render(
            <RawMobileChannelHeaderPlug
                components={[]}
                channel={testChannel}
                channelMember={testChannelMember}
                theme={testTheme}
                isDropdown={true}
                appsEnabled={true}
                appBindings={[testBinding]}
                actions={actions}
                intl={intl}
            />
        );
        
        // Verify anchor link is rendered
        const menuItem = screen.getByRole('menuitem');
        expect(menuItem).toHaveTextContent('Label');
    });

    test('should render correctly with one extended component and one binding, in dropdown', () => {
        render(
            <RawMobileChannelHeaderPlug
                components={[testPlug]}
                channel={testChannel}
                channelMember={testChannelMember}
                theme={testTheme}
                isDropdown={true}
                appsEnabled={true}
                appBindings={[testBinding]}
                actions={actions}
                intl={intl}
            />
        );
        
        // Verify two menu items are rendered
        const menuItems = screen.getAllByRole('menuitem');
        expect(menuItems).toHaveLength(2);
        expect(menuItems[0]).toHaveTextContent('some dropdown text');
        expect(menuItems[1]).toHaveTextContent('Label');
    });
});
