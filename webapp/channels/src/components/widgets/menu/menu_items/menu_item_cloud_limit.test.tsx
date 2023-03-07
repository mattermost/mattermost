// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Provider} from 'react-redux';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';
import mockStore from 'tests/test_store';

import {FileSizes} from 'utils/file_utils';
import {limitThresholds} from 'utils/limits';

import MenuItemCloudLimit from './menu_item_cloud_limit';

const zeroUsage = {
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
        enabled: 0,
        enabledLoaded: true,
    },
    teams: {
        active: 0,
        teamsLoaded: true,
    },
};

const general = {
    license: {
        IsLicensed: 'true',
        Cloud: 'true',
    },
};

const subscription = {
    is_free_trial: 'false',
};

const messageLimit = 10000;
const warnMessageUsage = Math.ceil((limitThresholds.warn / 100) * messageLimit) + 1;
const critialMessageUsage = Math.ceil((limitThresholds.danger / 100) * messageLimit) + 1;

const limits = {
    limitsLoaded: true,
    limits: {
        integrations: {
            enabled: 5,
        },
        messages: {
            history: messageLimit,
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

const usageWarnMessages = {
    ...zeroUsage,
    messages: {
        ...zeroUsage.messages,
        history: warnMessageUsage,
    },
};

const usageCriticalMessages = {
    ...zeroUsage,
    messages: {
        ...zeroUsage.messages,
        history: critialMessageUsage,
    },
};

const users = {
    currentUserId: 'user_id',
    profiles: {
        user_id: {},
    },
};

const id = 'menuItemCloudLimit';

describe('components/widgets/menu/menu_items/menu_item_cloud_limit', () => {
    test('Does not render if not cloud', () => {
        const state = {
            entities: {
                general: {
                    license: {
                        IsLicensed: 'true',
                        Cloud: 'false',
                    },
                },
                cloud: {
                    subscription: {
                        is_free_trial: 'false',
                    },
                    limits,
                },
                users,
                usage: usageWarnMessages,
            },
        };
        const store = mockStore(state);
        const wrapper = mountWithIntl(<Provider store={store}><MenuItemCloudLimit id={id}/></Provider>);
        expect(wrapper.find('li').exists()).toEqual(false);
    });

    test('Does not render if free trial', () => {
        const state = {
            entities: {
                general,
                cloud: {
                    subscription: {
                        is_free_trial: 'true',
                    },
                    limits,
                },
                users,
                usage: usageWarnMessages,
            },
        };
        const store = mockStore(state);
        const wrapper = mountWithIntl(<Provider store={store}><MenuItemCloudLimit id={id}/></Provider>);
        expect(wrapper.find('li').exists()).toEqual(false);
    });

    test('Does not render if no highest limit', () => {
        const state = {
            entities: {
                general,
                cloud: {
                    subscription,
                    limits,
                },
                users,
                usage: zeroUsage,
            },
        };
        const store = mockStore(state);
        const wrapper = mountWithIntl(<Provider store={store}><MenuItemCloudLimit id={id}/></Provider>);

        expect(wrapper.find('li').exists()).toEqual(false);
    });

    test('renders when a limit needs attention', () => {
        const state = {
            entities: {
                general,
                cloud: {
                    subscription,
                    limits,
                },
                users,
                usage: usageWarnMessages,
            },
        };
        const store = mockStore(state);
        const wrapper = mountWithIntl(<Provider store={store}><MenuItemCloudLimit id={id}/></Provider>);
        expect(wrapper.find('li').exists()).toEqual(true);
    });

    test('shows more attention grabbing UI and notify admin CTA if a limit is very close for non admin users', () => {
        const state = {
            entities: {
                general,
                cloud: {
                    subscription,
                    limits,
                },
                users,
                usage: usageCriticalMessages,
                teams: {
                    currentTeamId: 'current_team_id',
                },
            },
        };
        const store = mockStore(state);
        const wrapper = mountWithIntl(<Provider store={store}><MenuItemCloudLimit id={id}/></Provider>);
        expect(wrapper.find('li').prop('className')).toContain('critical');
        expect(wrapper.find('NotifyAdminCTA')).toHaveLength(1);
    });

    test('shows more attention grabbing UI if a limit is very close for admins', () => {
        const state = {
            entities: {
                general,
                cloud: {
                    subscription,
                    limits,
                },
                users: {
                    currentUserId: 'current_user_id',
                    profiles: {
                        current_user_id: {roles: 'system_admin'},
                    },
                },
                usage: usageCriticalMessages,
                teams: {
                    currentTeamId: 'current_team_id',
                },
            },
        };
        const store = mockStore(state);
        const wrapper = mountWithIntl(<Provider store={store}><MenuItemCloudLimit id={id}/></Provider>);
        expect(wrapper.find('li').prop('className')).toContain('critical');
        expect(wrapper.find('a')).toHaveLength(1);
        expect(wrapper.find('a').text()).toEqual('View upgrade options.');
    });
});

