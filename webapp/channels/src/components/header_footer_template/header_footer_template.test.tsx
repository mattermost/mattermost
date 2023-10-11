// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithIntlAndStore} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import HeaderFooterNotLoggedIn from './header_footer_template';

describe('components/HeaderFooterTemplate', () => {
    const RealDate: DateConstructor = Date;

    function mockDate(date: Date) {
        function mock() {
            return new RealDate(date);
        }
        mock.now = () => date.getTime();
        global.Date = mock as any;
    }

    const state = {
        entities: {
            general: {
                config: {},
            },
            users: {
                currentUserId: '',
                profiles: {
                    user1: {
                        id: 'user1',
                        roles: '',
                    },
                },
            },
            teams: {
                currentTeamId: 'team1',
                teams: {
                    team1: {
                        id: 'team1',
                        name: 'team-1',
                        displayName: 'Team 1',
                    },
                },
                myMembers: {
                    team1: {roles: 'team_role'},
                },
            },
        },
        storage: {
            initialized: true,
        },
    } as unknown as GlobalState;

    const renderComponent = (component: React.ReactNode, state: DeepPartial<GlobalState>) => {
        const rootDiv = document.createElement('div');
        rootDiv.id = 'root';
        rootDiv.setAttribute('data-testid', 'root-testid');

        return renderWithIntlAndStore(
            component,
            state,
            'en',
            rootDiv,
        );
    };

    beforeEach(() => {
        mockDate(new Date(2017, 6, 1));
    });

    afterEach(() => {
        global.Date = RealDate;
    });

    test('should match snapshot without children', () => {
        const {container} = renderComponent(<HeaderFooterNotLoggedIn/>, state as DeepPartial<GlobalState>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with children', () => {
        const {container} = renderComponent(
            <HeaderFooterNotLoggedIn>
                <p>{'test'}</p>
            </HeaderFooterNotLoggedIn>,
            state as DeepPartial<GlobalState>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with help link', () => {
        state.entities.general.config = {HelpLink: 'http://testhelplink'};

        const {container} = renderComponent(<HeaderFooterNotLoggedIn/>, state as DeepPartial<GlobalState>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with term of service link', () => {
        state.entities.general.config = {TermsOfServiceLink: 'http://testtermsofservicelink'};

        const {container} = renderComponent(<HeaderFooterNotLoggedIn/>, state as DeepPartial<GlobalState>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with privacy policy link', () => {
        state.entities.general.config = {PrivacyPolicyLink: 'http://testprivacypolicylink'};

        const {container} = renderComponent(<HeaderFooterNotLoggedIn/>, state as DeepPartial<GlobalState>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with about link', () => {
        state.entities.general.config = {AboutLink: 'http://testaboutlink'};

        const {container} = renderComponent(<HeaderFooterNotLoggedIn/>, state as DeepPartial<GlobalState>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with all links', () => {
        state.entities.general.config = {
            HelpLink: 'http://testhelplink',
            TermsOfServiceLink: 'http://testtermsofservicelink',
            PrivacyPolicyLink: 'http://testprivacypolicylink',
            AboutLink: 'http://testaboutlink',
        };

        const {container} = renderComponent(<HeaderFooterNotLoggedIn/>, state as DeepPartial<GlobalState>);
        expect(container).toMatchSnapshot();
    });

    test('should set classes on body and #root on mount and unset on unmount', () => {
        state.entities.general.config = {
            HelpLink: 'http://testhelplink',
            TermsOfServiceLink: 'http://testtermsofservicelink',
            PrivacyPolicyLink: 'http://testprivacypolicylink',
            AboutLink: 'http://testaboutlink',
        };
        expect(document.body.classList.contains('sticky')).toBe(false);
        const {container, unmount} = renderComponent(<HeaderFooterNotLoggedIn/>, state as DeepPartial<GlobalState>);
        expect(container).toMatchSnapshot();
        expect(document.body.classList.contains('sticky')).toBe(true);

        unmount();
        expect(document.body.classList.contains('sticky')).toBe(false);
        expect(container).toMatchSnapshot();
    });
});
