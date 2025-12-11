// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';
import {DataSearchTypes} from 'utils/constants';
import {FileSizes} from 'utils/file_utils';
import {makeEmptyUsage} from 'utils/limits_test';

import SearchLimitsBanner from './search_limits_banner';

const usage = makeEmptyUsage();

const limits = {
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
            teamsLoaded: true,
        },
        boards: {
            cards: 500,
            views: 5,
        },
    },
};

describe('components/select_results/SearchLimitsBanner', () => {
    test('should NOT show banner for no limits when doing messages search', () => {
        const state = {
            entities: {
                general: {
                    license: {
                        IsLicensed: 'true',
                    },
                },
                users: {
                    currentUserId: 'uid',
                    profiles: {
                        uid: {},
                    },
                },
                limits: {
                    serverLimits: undefined,
                },
                search: {
                    results: [],
                    flagged: [],
                    isSearchingTerm: false,
                    isSearchGettingMore: false,
                    matches: {},
                    current: {},
                    truncationInfo: undefined,
                },
                usage,
            },
            views: {
                rhs: {
                    rhsState: null, // No RHS state
                },
            },
        };
        renderWithContext(<SearchLimitsBanner searchType='messages'/>, state);
        expect(document.querySelector('#messages_search_limits_banner')).not.toBeInTheDocument();
    });
    test('should show banner when doing messages search above the limit in Entry with limits', () => {
        const aboveMessagesLimitUsage = JSON.parse(JSON.stringify(usage));
        aboveMessagesLimitUsage.messages.history = 15000; // above limit of 10K

        const state = {
            entities: {
                general: {
                    license: {
                        IsLicensed: 'true',
                    },
                },
                users: {
                    currentUserId: 'uid',
                    profiles: {
                        uid: {},
                    },
                },
                cloud: {
                    subscription: {
                        is_free_trial: 'true',
                        product_id: 'prod_1', // free
                    },
                    limits,
                },
                limits: {
                    serverLimits: {
                        postHistoryLimit: 10000,
                    },
                },
                usage: aboveMessagesLimitUsage,
                search: {
                    results: [],
                    flagged: [],
                    isSearchingTerm: false,
                    isSearchGettingMore: false,
                    matches: {},
                    current: {},
                    truncationInfo: {
                        posts: 1, // Indicate that search is truncated
                        files: 0,
                    },
                },
            },
            views: {
                rhs: {
                    rhsState: 'search', // RHS showing search results
                },
            },
        };
        renderWithContext(<SearchLimitsBanner searchType='messages'/>, state);
        expect(document.querySelector('#messages_search_limits_banner')).toBeInTheDocument();
    });

    test('should display "View plans" CTA text for messages search when banner is shown', () => {
        const aboveMessagesLimitUsage = JSON.parse(JSON.stringify(usage));
        aboveMessagesLimitUsage.messages.history = 15000; // above limit of 10K

        const state = {
            entities: {
                general: {
                    license: {
                        IsLicensed: 'true',
                        Cloud: 'true',
                    },
                },
                users: {
                    currentUserId: 'uid',
                    profiles: {
                        uid: {},
                    },
                },
                cloud: {
                    subscription: {
                        is_free_trial: 'true',
                        product_id: 'prod_1', // free
                    },
                    limits,
                },
                limits: {
                    serverLimits: {
                        postHistoryLimit: 10000,
                    },
                },
                usage: aboveMessagesLimitUsage,
                search: {
                    results: [],
                    flagged: [],
                    isSearchingTerm: false,
                    isSearchGettingMore: false,
                    matches: {},
                    current: {},
                    truncationInfo: {
                        posts: 1, // Indicate that search is truncated
                        files: 0,
                    },
                },
            },
            views: {
                rhs: {
                    rhsState: 'search', // RHS showing search results
                },
            },
        };

        renderWithContext(<SearchLimitsBanner searchType={DataSearchTypes.MESSAGES_SEARCH_TYPE}/>, state);

        expect(document.querySelector('#messages_search_limits_banner')).toBeInTheDocument();
        expect(screen.getByText(/paid plans/)).toBeInTheDocument();
    });

    test('should display correct banner message format for messages search', () => {
        const aboveMessagesLimitUsage = JSON.parse(JSON.stringify(usage));
        aboveMessagesLimitUsage.messages.history = 15000; // above limit of 10K

        const state = {
            entities: {
                general: {
                    license: {
                        IsLicensed: 'true',
                        Cloud: 'true',
                    },
                },
                users: {
                    currentUserId: 'uid',
                    profiles: {
                        uid: {},
                    },
                },
                cloud: {
                    subscription: {
                        is_free_trial: 'true',
                        product_id: 'prod_1', // free
                    },
                    limits,
                },
                limits: {
                    serverLimits: {
                        postHistoryLimit: 10000,
                    },
                },
                usage: aboveMessagesLimitUsage,
                search: {
                    results: [],
                    flagged: [],
                    isSearchingTerm: false,
                    isSearchGettingMore: false,
                    matches: {},
                    current: {},
                    truncationInfo: {
                        posts: 1, // Indicate that search is truncated
                        files: 0,
                    },
                },
            },
            views: {
                rhs: {
                    rhsState: 'search', // RHS showing search results
                },
            },
        };

        renderWithContext(<SearchLimitsBanner searchType={DataSearchTypes.MESSAGES_SEARCH_TYPE}/>, state);

        expect(screen.getByText(/Limited history is displayed/)).toBeInTheDocument();
        expect(screen.getByText(/Full access to message history is included in/)).toBeInTheDocument();
    });

    test('should render CTA link correctly when banner is shown', () => {
        const aboveMessagesLimitUsage = JSON.parse(JSON.stringify(usage));
        aboveMessagesLimitUsage.messages.history = 15000; // above limit of 10K

        // Test focuses on verifying component renders correctly with proper CTA

        const state = {
            entities: {
                general: {
                    license: {
                        IsLicensed: 'true',
                        Cloud: 'true',
                    },
                },
                users: {
                    currentUserId: 'uid',
                    profiles: {
                        uid: {},
                    },
                },
                cloud: {
                    subscription: {
                        is_free_trial: 'true',
                        product_id: 'prod_1', // free
                    },
                    limits,
                },
                limits: {
                    serverLimits: {
                        postHistoryLimit: 10000,
                    },
                },
                usage: aboveMessagesLimitUsage,
                search: {
                    results: [],
                    flagged: [],
                    isSearchingTerm: false,
                    isSearchGettingMore: false,
                    matches: {},
                    current: {},
                    truncationInfo: {
                        posts: 1, // Indicate that search is truncated
                        files: 0,
                    },
                },
            },
            views: {
                rhs: {
                    rhsState: 'search', // RHS showing search results
                },
            },
        };

        renderWithContext(<SearchLimitsBanner searchType={DataSearchTypes.MESSAGES_SEARCH_TYPE}/>, state);

        // Verify the banner is shown and contains the CTA link
        expect(document.querySelector('#messages_search_limits_banner')).toBeInTheDocument();
        expect(screen.getByText(/paid plans/)).toBeInTheDocument();

        // Find the CTA link
        const ctaLink = screen.getByRole('link');
        expect(ctaLink).toBeInTheDocument();
    });

    test('should NOT show banner when RHS is showing pinned posts even with truncated search results', () => {
        const aboveMessagesLimitUsage = JSON.parse(JSON.stringify(usage));
        aboveMessagesLimitUsage.messages.history = 15000; // above limit of 10K

        const state = {
            entities: {
                general: {
                    license: {
                        IsLicensed: 'true',
                        Cloud: 'true',
                    },
                },
                users: {
                    currentUserId: 'uid',
                    profiles: {
                        uid: {},
                    },
                },
                cloud: {
                    subscription: {
                        is_free_trial: 'true',
                        product_id: 'prod_1', // free
                    },
                    limits,
                },
                limits: {
                    serverLimits: {
                        postHistoryLimit: 10000,
                    },
                },
                usage: aboveMessagesLimitUsage,
                search: {
                    results: [],
                    flagged: [],
                    isSearchingTerm: false,
                    isSearchGettingMore: false,
                    matches: {},
                    current: {},
                    truncationInfo: {
                        posts: 1, // Search is truncated, but...
                        files: 0,
                    },
                },
            },
            views: {
                rhs: {
                    rhsState: 'pin', // RHS showing pinned posts, not search results
                },
            },
        };

        renderWithContext(<SearchLimitsBanner searchType={DataSearchTypes.MESSAGES_SEARCH_TYPE}/>, state);

        // Banner should NOT show because RHS is showing pinned posts, not search results
        expect(document.querySelector('#messages_search_limits_banner')).not.toBeInTheDocument();
    });
});
