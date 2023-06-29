// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import * as redux from 'react-redux';

import {renderWithIntl, screen} from 'tests/react_testing_utils';
import mockStore from 'tests/test_store';

import {CloudProducts} from 'utils/constants';
import {FileSizes} from 'utils/file_utils';

import DowngradeTeamRemovalModal from './';

describe('components/pricing_modal/downgrade_team_removal_modal', () => {
    beforeEach(() => {
        jest.spyOn(redux, 'useDispatch').mockImplementation(
            jest.fn(() => jest.fn()),
        );
    });

    const state = {
        entities: {
            users: {
                currentUserId: 'user1',
                profiles: {
                    user1: {
                        id: 'user1',
                        roles: '',
                    },
                },
            },
            usage: {
                files: {
                    totalStorage: 0,
                    totalStorageLoaded: true,
                },
                messages: {
                    history: 0,
                    historyLoaded: true,
                },
                boards: {
                    cards: 0,
                    cardsLoaded: true,
                },
                integrations: {
                    enabled: 3,
                    enabledLoaded: true,
                },
                teams: {
                    active: 4,
                    cloudArchived: 0,
                    teamsLoaded: true,
                },
            },
            teams: {
                currentTeamId: 'frggfw9objyz5e6ma7ibpx6jda',
                teams: {
                    frggfw9objyz5e6ma7ibpx6jda: {
                        id: 'frggfw9objyz5e6ma7ibpx6jda',
                        create_at: 1654097827977,
                        update_at: 1654783962398,
                        delete_at: 0,
                        display_name: 'Team 4',
                        name: 'team-4',
                        description: '',
                        email: 'test@example.com',
                        type: 'O',
                        company_name: '',
                        allowed_domains: '',
                        invite_id: 'jagqnrb5ubb78grwebzckmpxxa',
                        allow_open_invite: false,
                        scheme_id: null,
                        group_constrained: null,
                        policy_id: null,
                        cloud_limits_archived: false,
                    },
                    ypbsfrr583yc9futzyghpmhc6r: {
                        id: 'ypbsfrr583yc9futzyghpmhc6r',
                        create_at: 1652892296690,
                        update_at: 1654784021789,
                        delete_at: 0,
                        display_name: 'team 3',
                        name: 'team-3',
                        description: '',
                        email: 'test@example.com',
                        type: 'O',
                        company_name: '',
                        allowed_domains: '',
                        invite_id: 'cfqgw4utbpfjucjqjaddg6mxmo',
                        allow_open_invite: false,
                        scheme_id: null,
                        group_constrained: false,
                        policy_id: null,
                        cloud_limits_archived: false,
                    },
                    p6kpct39xigtpxfk739dwu9eny: {
                        id: 'p6kpct39xigtpxfk739dwu9eny',
                        create_at: 1652891664653,
                        update_at: 1654784021776,
                        delete_at: 0,
                        display_name: 'second team',
                        name: 'second-team',
                        description: '',
                        email: 'test@example.com',
                        type: 'O',
                        company_name: '',
                        allowed_domains: '',
                        invite_id: 'yefar6zmoiya8dsw59oiw9xwac',
                        allow_open_invite: false,
                        scheme_id: null,
                        group_constrained: false,
                        policy_id: null,
                        cloud_limits_archived: false,
                    },
                    qet86xzhwpbim841jwyfh3fgwe: {
                        id: 'qet86xzhwpbim841jwyfh3fgwe',
                        create_at: 1652891651309,
                        update_at: 1654784021766,
                        delete_at: 0,
                        display_name: 'first team',
                        name: 'first-team',
                        description: '',
                        email: 'test@example.com',
                        type: 'O',
                        company_name: '',
                        allowed_domains: '',
                        invite_id: '3qm66p1ub3n17rbi7f315wqsdy',
                        allow_open_invite: false,
                        scheme_id: null,
                        group_constrained: false,
                        policy_id: null,
                        cloud_limits_archived: false,
                    },
                },
                myMembers: {
                    frggfw9objyz5e6ma7ibpx6jda: {
                        mention_count: 0,
                        msg_count: 0,
                        mention_count_root: 0,
                        msg_count_root: 0,
                        team_id: 'frggfw9objyz5e6ma7ibpx6jda',
                        user_id: 'jp1dthppbfri5d46impk1ndk8a',
                        roles: 'team_user team_admin',
                        delete_at: 0,
                        scheme_guest: false,
                        scheme_user: true,
                        scheme_admin: true,
                        explicit_roles: '',
                    },
                    ypbsfrr583yc9futzyghpmhc6r: {
                        mention_count: 0,
                        msg_count: 0,
                        mention_count_root: 0,
                        msg_count_root: 0,
                        team_id: 'ypbsfrr583yc9futzyghpmhc6r',
                        user_id: 'jp1dthppbfri5d46impk1ndk8a',
                        roles: 'team_user team_admin',
                        delete_at: 0,
                        scheme_guest: false,
                        scheme_user: true,
                        scheme_admin: true,
                        explicit_roles: '',
                    },
                    p6kpct39xigtpxfk739dwu9eny: {
                        mention_count: 0,
                        msg_count: 0,
                        mention_count_root: 0,
                        msg_count_root: 0,
                        team_id: 'p6kpct39xigtpxfk739dwu9eny',
                        user_id: 'jp1dthppbfri5d46impk1ndk8a',
                        roles: 'team_user team_admin',
                        delete_at: 0,
                        scheme_guest: false,
                        scheme_user: true,
                        scheme_admin: true,
                        explicit_roles: '',
                    },
                    qet86xzhwpbim841jwyfh3fgwe: {
                        mention_count: 0,
                        msg_count: 0,
                        mention_count_root: 0,
                        msg_count_root: 0,
                        team_id: 'qet86xzhwpbim841jwyfh3fgwe',
                        user_id: 'jp1dthppbfri5d46impk1ndk8a',
                        roles: 'team_user team_admin',
                        delete_at: 0,
                        scheme_guest: false,
                        scheme_user: true,
                        scheme_admin: true,
                        explicit_roles: '',
                    },
                    isw1dyt5ijnozg8frzjb1uongr: {
                        mention_count: 0,
                        msg_count: 0,
                        mention_count_root: 0,
                        msg_count_root: 0,
                        team_id: 'isw1dyt5ijnozg8frzjb1uongr',
                        user_id: 'jp1dthppbfri5d46impk1ndk8a',
                        roles: 'team_user team_admin',
                        delete_at: 0,
                        scheme_guest: false,
                        scheme_user: true,
                        scheme_admin: true,
                        explicit_roles: '',
                    },
                    m1niyeo5n3fc9kb41dthno6xgy: {
                        mention_count: 0,
                        msg_count: 0,
                        mention_count_root: 0,
                        msg_count_root: 0,
                        team_id: 'm1niyeo5n3fc9kb41dthno6xgy',
                        user_id: 'jp1dthppbfri5d46impk1ndk8a',
                        roles: 'team_user team_admin',
                        delete_at: 0,
                        scheme_guest: false,
                        scheme_user: true,
                        scheme_admin: true,
                        explicit_roles: '',
                    },
                    '51ifbyhn6b8s7es7nbu5faezhc': {
                        mention_count: 0,
                        msg_count: 0,
                        mention_count_root: 0,
                        msg_count_root: 0,
                        team_id: '51ifbyhn6b8s7es7nbu5faezhc',
                        user_id: 'jp1dthppbfri5d46impk1ndk8a',
                        roles: 'team_user team_admin',
                        delete_at: 0,
                        scheme_guest: false,
                        scheme_user: true,
                        scheme_admin: true,
                        explicit_roles: '',
                    },
                    n8h6tsdfipn79eho3k1dj69jba: {
                        mention_count: 0,
                        msg_count: 0,
                        mention_count_root: 0,
                        msg_count_root: 0,
                        team_id: 'n8h6tsdfipn79eho3k1dj69jba',
                        user_id: 'jp1dthppbfri5d46impk1ndk8a',
                        roles: 'team_user team_admin',
                        delete_at: 0,
                        scheme_guest: false,
                        scheme_user: true,
                        scheme_admin: true,
                        explicit_roles: '',
                    },
                },
                membersInTeam: {},
                stats: {},
                groupsAssociatedToTeam: {},
                totalCount: 0,
            },
            admin: {},
            general: {
                license: {
                    IsLicensed: 'true',
                    Cloud: 'true',
                },
                credentials: {
                    url: 'http://example.com',
                },
            },
            cloud: {
                subscription: {
                    is_free_trial: 'false',
                    trial_end_at: 0,
                    product_id: 'prod_free',
                },
                limits: {
                    limitsLoaded: true,
                    limits: {
                        integrations: {
                            enabled: 5,
                        },
                        messages: {
                            history: 10000,
                        },
                        files: {
                            total_storage: FileSizes.Gigabyte,
                        },
                        teams: {
                            active: 1,
                        },
                        boards: {
                            cards: 500,
                            views: 5,
                        },
                    },
                },
                products: {
                    prod_free: {
                        id: 'prod_free',
                        name: 'Cloud Free',
                        sku: CloudProducts.STARTER,
                        price_per_seat: 0,
                        product_family: 'cloud',
                        description: '',
                        add_ons: [],
                        billing_scheme: 'flat_fee',
                        recurring_interval: 'month',
                        cross_sells_to: '',
                    },
                    prod_enterprise: {
                        id: 'prod_enterprise',
                        name: 'Cloud Enterprise',
                        sku: CloudProducts.ENTERPRISE,
                    },
                },
            },
        },
        views: {
            modals: {
                modalState: {
                    cloud_downgrade_choose_team: {
                        open: 'true',
                    },
                },
            },
        },
    };

    test('renders modal', () => {
        const store = mockStore(state);
        renderWithIntl(
            <redux.Provider store={store}>
                <DowngradeTeamRemovalModal
                    product_id={'prod_free'}
                    starterProduct={state.entities.cloud.products.prod_free}
                />
            </redux.Provider>,
        );
        expect(screen.getByText('Confirm Plan Downgrade')).toBeInTheDocument();
        expect(screen.getByText('Which team would you like to continue using?')).toBeInTheDocument();
    });

    test('renders dropdown with 4+ teams', () => {
        const store = mockStore(state);
        renderWithIntl(
            <redux.Provider store={store}>
                <DowngradeTeamRemovalModal
                    product_id={'prod_free'}
                    starterProduct={state.entities.cloud.products.prod_free}
                />
            </redux.Provider>,
        );
        expect(screen.getByTestId('deleteTeamDropdownInput')).toBeInTheDocument();
    });

    test('renders radio buttons with fewer than 4 teams', () => {
        const newState = {...state};
        newState.entities.usage.teams.active = 2;
        const store = mockStore(state);
        renderWithIntl(
            <redux.Provider store={store}>
                <DowngradeTeamRemovalModal
                    product_id={'prod_free'}
                    starterProduct={state.entities.cloud.products.prod_free}
                />
            </redux.Provider>,
        );
        expect(screen.getByTestId('deleteTeamRadioGroup')).toBeInTheDocument();
    });
});
