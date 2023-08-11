// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';
import {IntlProvider} from 'react-intl';
import {Provider} from 'react-redux';

import {shallow} from 'enzyme';

import {Preferences} from 'mattermost-redux/constants';

import {render, fireEvent, screen} from 'tests/react_testing_utils';
import mockStore from 'tests/test_store';

import UserSettingsTheme from './user_settings_theme';

jest.mock('utils/utils', () => ({
    applyTheme: jest.fn(),
    toTitleCase: jest.fn(),
    a11yFocus: jest.fn(),
}));

describe('components/user_settings/display/user_settings_theme/user_settings_theme.jsx', () => {
    const initialState = {
        entities: {
            general: {
                config: {},
                license: {
                    Cloud: 'false',
                },
            },
            users: {
                currentUserId: 'currentUserId',
            },
        },
    };
    const store = mockStore(initialState);

    const requiredProps: ComponentProps<typeof UserSettingsTheme> = {
        theme: Preferences.THEMES.denim,
        currentTeamId: 'teamId',
        selected: false,
        updateSection: jest.fn(),
        setRequireConfirm: jest.fn(),
        setEnforceFocus: jest.fn(),
        actions: {
            saveTheme: jest.fn().mockResolvedValue({data: true}),
            deleteTeamSpecificThemes: jest.fn().mockResolvedValue({data: true}),
            openModal: jest.fn(),
        },
        allowCustomThemes: true,
        showAllTeamsCheckbox: true,
        applyToAllTeams: true,
        areAllSectionsInactive: false,
    };

    it('should match snapshot', () => {
        const wrapper = shallow(
            <UserSettingsTheme {...requiredProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    it('should saveTheme', async () => {
        const wrapper = shallow<UserSettingsTheme>(
            <UserSettingsTheme {...requiredProps}/>,
        );

        await wrapper.instance().submitTheme();

        expect(requiredProps.setRequireConfirm).toHaveBeenCalledTimes(1);
        expect(requiredProps.setRequireConfirm).toHaveBeenCalledWith(false);

        expect(requiredProps.updateSection).toHaveBeenCalledTimes(1);
        expect(requiredProps.updateSection).toHaveBeenCalledWith('');

        expect(requiredProps.actions.saveTheme).toHaveBeenCalled();
    });

    it('should deleteTeamSpecificThemes if applyToAllTeams is enabled', async () => {
        const props = {
            ...requiredProps,
            actions: {
                saveTheme: jest.fn().mockResolvedValue({data: true}),
                deleteTeamSpecificThemes: jest.fn().mockResolvedValue({data: true}),
                openModal: jest.fn(),
            },
        };

        const wrapper = shallow<UserSettingsTheme>(
            <UserSettingsTheme {...props}/>,
        );

        wrapper.instance().setState({applyToAllTeams: true});
        await wrapper.instance().submitTheme();

        expect(props.actions.deleteTeamSpecificThemes).toHaveBeenCalled();
    });

    it('should call openModal when slack import theme button is clicked', async () => {
        const props = {
            ...requiredProps,
            allowCustomThemes: true,
            selected: true,
        };

        render(
            <IntlProvider locale={'en'}>
                <Provider store={store}>
                    <UserSettingsTheme {...props}/>
                </Provider>
            </IntlProvider>,
        );

        // Click the Slack Import button
        fireEvent.click(screen.getByText('Import theme colors from Slack'));

        expect(props.actions.openModal).toHaveBeenCalledTimes(1);
    });
});
