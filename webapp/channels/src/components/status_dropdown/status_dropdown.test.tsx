// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {CustomStatusDuration} from '@mattermost/types/users';
import type {UserProfile} from '@mattermost/types/users';

import {fakeDate} from 'tests/helpers/date';
import {shallowWithIntl} from 'tests/helpers/intl-test-helper';

import StatusDropdown from './status_dropdown';

describe('components/StatusDropdown', () => {
    let resetFakeDate: () => void;

    beforeEach(() => {
        resetFakeDate = fakeDate(new Date('2021-11-02T22:48:57Z'));
    });

    afterEach(() => {
        resetFakeDate();
    });

    const actions = {
        openModal: jest.fn(),
        setStatus: jest.fn(),
        unsetCustomStatus: jest.fn(),
        setStatusDropdown: jest.fn(),
        savePreferences: jest.fn(),
    };

    const baseProps = {
        actions,
        userId: '',
        currentUser: {
            id: 'user_id',
            first_name: 'Nev',
            last_name: 'Aa',
        } as UserProfile,
        userTimezone: {
            useAutomaticTimezone: 'true',
            automaticTimezone: 'America/New_York',
            manualTimezone: '',
        },
        status: 'away',
        isMilitaryTime: false,
        isCustomStatusEnabled: false,
        isCustomStatusExpired: false,
        isStatusDropdownOpen: false,
        showCustomStatusPulsatingDot: false,
        showCompleteYourProfileTour: false,
    };

    test('should match snapshot in default state', () => {
        const wrapper = shallowWithIntl(
            <StatusDropdown {...baseProps}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with profile picture URL', () => {
        const props = {
            ...baseProps,
            profilePicture: 'http://localhost:8065/api/v4/users/jsx5jmdiyjyuzp9rzwfaf5pwjo/image?_=1590519110944',
        };

        const wrapper = shallowWithIntl(
            <StatusDropdown {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with status dropdown open', () => {
        const props = {
            ...baseProps,
            isStatusDropdownOpen: true,
        };

        const wrapper = shallowWithIntl(
            <StatusDropdown {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with custom status enabled', () => {
        const props = {
            ...baseProps,
            isStatusDropdownOpen: true,
            isCustomStatusEnabled: true,
        };

        const wrapper = shallowWithIntl(
            <StatusDropdown {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with custom status pulsating dot enabled', () => {
        const props = {
            ...baseProps,
            isStatusDropdownOpen: true,
            isCustomStatusEnabled: true,
            showCustomStatusPulsatingDot: true,
        };

        const wrapper = shallowWithIntl(
            <StatusDropdown {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with custom status and expiry', () => {
        const customStatus = {
            emoji: 'calendar',
            text: 'In a meeting',
            duration: CustomStatusDuration.TODAY,
            expires_at: '2021-05-03T23:59:59.000Z',
        };
        const props = {
            ...baseProps,
            isStatusDropdownOpen: true,
            isCustomStatusEnabled: true,
            customStatus,
        };

        const wrapper = shallowWithIntl(
            <StatusDropdown {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with custom status expired', () => {
        const customStatus = {
            emoji: 'calendar',
            text: 'In a meeting',
            duration: CustomStatusDuration.TODAY,
            expires_at: '2021-05-03T23:59:59.000Z',
        };
        const props = {
            ...baseProps,
            isStatusDropdownOpen: true,
            isCustomStatusEnabled: true,
            isCustomStatusExpired: true,
            customStatus,
        };

        const wrapper = shallowWithIntl(
            <StatusDropdown {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should show clear status button when custom status is set', () => {
        const customStatus = {
            emoji: 'calendar',
            text: 'In a meeting',
            duration: CustomStatusDuration.TODAY,
            expires_at: '2021-05-03T23:59:59.000Z',
        };
        const props = {
            ...baseProps,
            isStatusDropdownOpen: true,
            isCustomStatusEnabled: true,
            isCustomStatusExpired: false,
            customStatus,
        };

        const wrapper = shallowWithIntl(
            <StatusDropdown {...props}/>,
        );

        expect(wrapper.find('.status-dropdown-menu__clear-container').exists()).toBe(true);
        expect(wrapper).toMatchSnapshot();
    });

    test('should not show clear status button when custom status is not set', () => {
        const customStatus = undefined;
        const props = {
            ...baseProps,
            isStatusDropdownOpen: true,
            isCustomStatusEnabled: true,
            isCustomStatusExpired: false,
            customStatus,
        };

        const wrapper = shallowWithIntl(
            <StatusDropdown {...props}/>,
        );

        expect(wrapper.find('.status-dropdown-menu__clear-container').exists()).toBe(false);
        expect(wrapper).toMatchSnapshot();
    });
});
