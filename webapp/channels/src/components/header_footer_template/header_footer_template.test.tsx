// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import mergeObjects from 'packages/mattermost-redux/test/merge_objects';
import {renderWithContext} from 'tests/react_testing_utils';

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

    const initialState: DeepPartial<GlobalState> = {
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
                        display_name: 'Team 1',
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
    };

    beforeEach(() => {
        mockDate(new Date(2017, 6, 1));
    });

    afterEach(() => {
        global.Date = RealDate;
    });

    test('should match snapshot without children', async () => {
        const {container} = await renderWithContext(<HeaderFooterNotLoggedIn/>, initialState);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with children', async () => {
        const {container} = await renderWithContext(
            <HeaderFooterNotLoggedIn>
                <p>{'test'}</p>
            </HeaderFooterNotLoggedIn>,
            initialState,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with help link', async () => {
        const state = mergeObjects(initialState, {
            entities: {
                general: {
                    config: {
                        HelpLink: 'http://testhelplink',
                    },
                },
            },
        });

        const {container} = await renderWithContext(<HeaderFooterNotLoggedIn/>, state);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with term of service link', async () => {
        const state = mergeObjects(initialState, {
            entities: {
                general: {
                    config: {
                        TermsOfServiceLink: 'http://testtermsofservicelink',
                    },
                },
            },
        });

        const {container} = await renderWithContext(<HeaderFooterNotLoggedIn/>, state);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with privacy policy link', async () => {
        const state = mergeObjects(initialState, {
            entities: {
                general: {
                    config: {
                        PrivacyPolicyLink: 'http://testprivacypolicylink',
                    },
                },
            },
        });

        const {container} = await renderWithContext(<HeaderFooterNotLoggedIn/>, state);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with about link', async () => {
        const state = mergeObjects(initialState, {
            entities: {
                general: {
                    config: {
                        AboutLink: 'http://testaboutlink',
                    },
                },
            },
        });

        const {container} = await renderWithContext(<HeaderFooterNotLoggedIn/>, state);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with all links', async () => {
        const state = mergeObjects(initialState, {
            entities: {
                general: {
                    config: {
                        HelpLink: 'http://testhelplink',
                        TermsOfServiceLink: 'http://testtermsofservicelink',
                        PrivacyPolicyLink: 'http://testprivacypolicylink',
                        AboutLink: 'http://testaboutlink',
                    },
                },
            },
        });

        const {container} = await renderWithContext(<HeaderFooterNotLoggedIn/>, state);
        expect(container).toMatchSnapshot();
    });

    test('should set classes on body and #root on mount and unset on unmount', async () => {
        const state = mergeObjects(initialState, {
            entities: {
                general: {
                    config: {
                        HelpLink: 'http://testhelplink',
                        TermsOfServiceLink: 'http://testtermsofservicelink',
                        PrivacyPolicyLink: 'http://testprivacypolicylink',
                        AboutLink: 'http://testaboutlink',
                    },
                },
            },
        });
        expect(document.body.classList.contains('sticky')).toBe(false);
        const {container, unmount} = await renderWithContext(<HeaderFooterNotLoggedIn/>, state);
        expect(container).toMatchSnapshot();
        expect(document.body.classList.contains('sticky')).toBe(true);

        unmount();
        expect(document.body.classList.contains('sticky')).toBe(false);
        expect(container).toMatchSnapshot();
    });
});
