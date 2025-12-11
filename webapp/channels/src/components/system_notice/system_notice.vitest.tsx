// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import SystemNotice from 'components/system_notice/system_notice';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

describe('components/SystemNotice', () => {
    const baseProps = {
        currentUserId: 'someid',
        preferences: {},
        dismissedNotices: {},
        isSystemAdmin: false,
        notices: [{name: 'notice1', adminOnly: false, title: 'some title', body: 'some body', allowForget: true, show: () => true}],
        serverVersion: '5.1',
        license: {IsLicensed: 'true'},
        config: {},
        analytics: {TOTAL_USERS: 300},
        intl: {
            formatMessage: vi.fn(),
        },
        actions: {
            savePreferences: vi.fn(),
            dismissNotice: vi.fn(),
            getStandardAnalytics: vi.fn(),
        },
    };

    test('should match snapshot for regular user, regular notice', () => {
        const {container} = renderWithContext(<SystemNotice {...baseProps}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot for regular user, no notice', () => {
        const props = {...baseProps, notices: []};
        const {container} = renderWithContext(<SystemNotice {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot for regular user, admin notice', () => {
        const props = {...baseProps, notices: [{...baseProps.notices[0], adminOnly: true}]};
        const {container} = renderWithContext(<SystemNotice {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot for regular user, admin and regular notice', () => {
        const props = {...baseProps,
            notices: [
                {...baseProps.notices[0], adminOnly: true},
                {...baseProps.notices[0], name: 'notice2', title: 'some title2', body: 'some body2'},
            ]};
        const {container} = renderWithContext(<SystemNotice {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot for admin, regular notice', () => {
        const props = {...baseProps, isSystemAdmin: true};
        const {container} = renderWithContext(<SystemNotice {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot for admin, admin notice', () => {
        const props = {...baseProps, isSystemAdmin: true, notices: [{...baseProps.notices[0], adminOnly: true}]};
        const {container} = renderWithContext(<SystemNotice {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot for regular user, dismissed notice', () => {
        const props = {...baseProps, dismissedNotices: {notice1: true}};
        const {container} = renderWithContext(<SystemNotice {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot for regular user, dont show again notice', () => {
        const props = {...baseProps, preferences: {notice1: {}}};
        const {container} = renderWithContext(<SystemNotice {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot for show function returning false', () => {
        const props = {...baseProps, notices: [{...baseProps.notices[0], show: () => false}]};
        const {container} = renderWithContext(<SystemNotice {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot for show function returning true', () => {
        const props = {...baseProps, notices: [{...baseProps.notices[0], show: () => true}]};
        const {container} = renderWithContext(<SystemNotice {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot for with allowForget equal false', () => {
        const props = {...baseProps, notices: [{...baseProps.notices[0], allowForget: false}]};
        const {container} = renderWithContext(<SystemNotice {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when a custom icon is passed', () => {
        const props = {...baseProps, notices: [{...baseProps.notices[0], icon: <span>{'icon'}</span>}]};
        const {container} = renderWithContext(<SystemNotice {...props}/>);
        expect(container).toMatchSnapshot();
    });
});
