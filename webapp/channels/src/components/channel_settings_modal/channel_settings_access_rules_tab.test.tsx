// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {act} from 'react-dom/test-utils';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ChannelSettingsAccessRulesTab from './channel_settings_access_rules_tab';

// Mock the hook
jest.mock('hooks/useChannelAccessControlActions');

// Mock TableEditor
jest.mock('components/admin_console/access_control/editors/table_editor/table_editor', () => {
    return jest.fn(() => <div data-testid={'table-editor'}>{'TableEditor'}</div>);
});

// Mock console methods
const consoleSpy = {
    error: jest.spyOn(console, 'error').mockImplementation(),
    warn: jest.spyOn(console, 'warn').mockImplementation(),
};

const mockUseChannelAccessControlActions = useChannelAccessControlActions as jest.MockedFunction<typeof useChannelAccessControlActions>;
const MockedTableEditor = TableEditor as jest.MockedFunction<typeof TableEditor>;

describe('components/channel_settings_modal/ChannelSettingsAccessRulesTab', () => {
    const mockActions = {
        getAccessControlFields: jest.fn(),
        getVisualAST: jest.fn(),
        searchUsers: jest.fn(),
    };

    const mockUserAttributes: UserPropertyField[] = [
        {
            id: 'attr1',
            name: 'department',
            type: 'select',
            group_id: 'custom_profile_attributes',
            create_at: 1736541716295,
            update_at: 1736541716295,
            delete_at: 0,
            attrs: {
                sort_order: 0,
                visibility: 'when_set',
                value_type: '',
                options: [
                    {id: 'eng', name: 'Engineering'},
                    {id: 'sales', name: 'Sales'},
                ],
            },
        },
        {
            id: 'attr2',
            name: 'location',
            type: 'select',
            group_id: 'custom_profile_attributes',
            create_at: 1736541716295,
            update_at: 1736541716295,
            delete_at: 0,
            attrs: {
                sort_order: 1,
                visibility: 'when_set',
                value_type: '',
                options: [
                    {id: 'us', name: 'US'},
                    {id: 'ca', name: 'Canada'},
                ],
            },
        },
    ];

    const baseProps = {
        channel: TestHelper.getChannelMock({
            id: 'channel_id',
            name: 'test-channel',
            display_name: 'Test Channel',
            type: 'P',
        }),
        setAreThereUnsavedChanges: jest.fn(),
        showTabSwitchError: false,
    };

    const initialState = {
        entities: {
            general: {
                config: {},
            },
            users: {
                currentUserId: 'current_user_id',
            },
        },
        plugins: {
            components: {},
        },
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <ChannelSettingsAccessRulesTab {...baseProps}/>,
            initialState,
        );

        expect(container).toMatchSnapshot();
    });

    test('should render access rules title and subtitle', () => {
        renderWithContext(
            <ChannelSettingsAccessRulesTab {...baseProps}/>,
            initialState,
        );

        expect(screen.getByRole('heading', {name: 'Access Rules'})).toBeInTheDocument();
        expect(screen.getByText('Select user attributes and values as rules to restrict channel membership')).toBeInTheDocument();
    });

    test('should render access rules description', () => {
        renderWithContext(
            <ChannelSettingsAccessRulesTab {...baseProps}/>,
            initialState,
        );

        expect(screen.getByText('Select attributes and values that users must match in addition to access this channel. All selected attributes are required.')).toBeInTheDocument();
    });

    test('should render with main container class', () => {
        renderWithContext(
            <ChannelSettingsAccessRulesTab {...baseProps}/>,
            initialState,
        );

        expect(screen.getByText('Access Rules').closest('.ChannelSettingsModal__accessRulesTab')).toBeInTheDocument();
    });

    test('should handle missing optional props gracefully', () => {
        const minimalProps = {
            channel: baseProps.channel,
        };

        expect(() => {
            renderWithContext(
                <ChannelSettingsAccessRulesTab {...minimalProps}/>,
                initialState,
            );
        }).not.toThrow();

        expect(screen.getByRole('heading', {name: 'Access Rules'})).toBeInTheDocument();
    });

    test('should render header section with correct structure', () => {
        renderWithContext(
            <ChannelSettingsAccessRulesTab {...baseProps}/>,
            initialState,
        );

        const header = screen.getByText('Access Rules').closest('.ChannelSettingsModal__accessRulesHeader');
        expect(header).toBeInTheDocument();

        // Check that both title and subtitle are within the header
        const title = screen.getByRole('heading', {name: 'Access Rules'});
        const subtitle = screen.getByText('Select user attributes and values as rules to restrict channel membership');

        expect(header).toContainElement(title);
        expect(header).toContainElement(subtitle);
    });

    test('should render with different channel types', () => {
        const publicChannel = TestHelper.getChannelMock({
            id: 'public_channel_id',
            name: 'public-channel',
            display_name: 'Public Channel',
            type: 'O',
        });

        const propsWithPublicChannel = {
            ...baseProps,
            channel: publicChannel,
        };

        renderWithContext(
            <ChannelSettingsAccessRulesTab {...propsWithPublicChannel}/>,
            initialState,
        );

        expect(screen.getByRole('heading', {name: 'Access Rules'})).toBeInTheDocument();
        expect(screen.getByText('Select user attributes and values as rules to restrict channel membership')).toBeInTheDocument();
    });

    test('should call useChannelAccessControlActions hook', () => {
        shallow(<ChannelSettingsAccessRulesTab {...baseProps}/>);

        expect(mockUseChannelAccessControlActions).toHaveBeenCalledTimes(1);
    });

    test('should load user attributes on mount', async () => {
        await act(async () => {
            mount(<ChannelSettingsAccessRulesTab {...baseProps}/>);
        });

        expect(mockActions.getAccessControlFields).toHaveBeenCalledWith('', 100);
    });

    test('should not render TableEditor initially when attributes are loading', () => {
        const wrapper = shallow(<ChannelSettingsAccessRulesTab {...baseProps}/>);

        expect(wrapper.find(TableEditor)).toHaveLength(0);
        expect(wrapper.find('.ChannelSettingsModal__accessRulesEditor')).toHaveLength(0);
    });

    test('should render TableEditor when attributes are loaded', async () => {
        const wrapper = mount(<ChannelSettingsAccessRulesTab {...baseProps}/>);

        // Wait for useEffect to complete with act()
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        wrapper.update();

        expect(wrapper.find('[data-testid="table-editor"]')).toHaveLength(1);
        expect(wrapper.find('.ChannelSettingsModal__accessRulesEditor')).toHaveLength(1);
    });

    test('should pass correct props to TableEditor', async () => {
        const wrapper = mount(<ChannelSettingsAccessRulesTab {...baseProps}/>);

        // Wait for useEffect to complete with act()
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        wrapper.update();

        expect(MockedTableEditor).toHaveBeenCalledWith(
            expect.objectContaining({
                value: '',
                userAttributes: mockUserAttributes,
                actions: mockActions,
                onChange: expect.any(Function),
                onValidate: expect.any(Function),
                onParseError: expect.any(Function),
            }),
            expect.anything(),
        );
    });

    test('should call setAreThereUnsavedChanges when expression changes', async () => {
        const setAreThereUnsavedChanges = jest.fn();
        const propsWithCallback = {
            ...baseProps,
            setAreThereUnsavedChanges,
        };

        const wrapper = mount(<ChannelSettingsAccessRulesTab {...propsWithCallback}/>);

        // Wait for useEffect to complete with act()
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        wrapper.update();

        // Get the onChange callback passed to TableEditor
        const onChangeCallback = MockedTableEditor.mock.calls[0][0].onChange;

        // Simulate expression change
        act(() => {
            onChangeCallback('user.attributes.department == "Engineering"');
        });

        expect(setAreThereUnsavedChanges).toHaveBeenCalledWith(true);
    });

    test('should not call setAreThereUnsavedChanges when callback is not provided', async () => {
        const propsWithoutCallback = {
            ...baseProps,
            setAreThereUnsavedChanges: undefined,
        };

        const wrapper = mount(<ChannelSettingsAccessRulesTab {...propsWithoutCallback}/>);

        // Wait for useEffect to complete with act()
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        wrapper.update();

        // Get the onChange callback passed to TableEditor
        const onChangeCallback = MockedTableEditor.mock.calls[0][0].onChange;

        // Simulate expression change - should not throw error
        expect(() => {
            act(() => {
                onChangeCallback('user.attributes.department == "Engineering"');
            });
        }).not.toThrow();
    });

    test('should handle error when loading attributes fails', async () => {
        // Suppress expected console error for this test
        const originalError = console.error;
        console.error = jest.fn();

        const errorMessage = 'Failed to load attributes';
        mockActions.getAccessControlFields.mockRejectedValue(new Error(errorMessage));

        const wrapper = mount(<ChannelSettingsAccessRulesTab {...baseProps}/>);

        // Wait for useEffect to complete with act()
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        wrapper.update();

        expect(console.error).toHaveBeenCalledWith('Failed to load access control fields:', expect.any(Error));

        // Should still render editor even after error (with empty attributes)
        expect(wrapper.find('[data-testid="table-editor"]')).toHaveLength(1);

        // Restore console.error
        console.error = originalError;
    });

    test('should handle parse error from TableEditor', async () => {
        // Suppress expected console warning for this test
        const originalWarn = console.warn;
        console.warn = jest.fn();

        const wrapper = mount(<ChannelSettingsAccessRulesTab {...baseProps}/>);

        // Wait for useEffect to complete with act()
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        wrapper.update();

        // Get the onParseError callback passed to TableEditor
        const onParseErrorCallback = MockedTableEditor.mock.calls[0][0].onParseError;

        // Simulate parse error
        act(() => {
            onParseErrorCallback('Parse error message');
        });

        expect(console.warn).toHaveBeenCalledWith('Failed to parse expression in table editor');

        // Restore console.warn
        console.warn = originalWarn;
    });

    test('should render description text', () => {
        const wrapper = shallow(<ChannelSettingsAccessRulesTab {...baseProps}/>);

        expect(wrapper.find('.ChannelSettingsModal__accessRulesDescription')).toHaveLength(1);
    });
});
