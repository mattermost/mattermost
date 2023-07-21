// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Channel} from '@mattermost/types/channels';
import {MarketplaceApp, MarketplacePlugin} from '@mattermost/types/marketplace';
import {Team} from '@mattermost/types/teams';
import {UserThread} from '@mattermost/types/threads';
import {RelationOneToOne} from '@mattermost/types/utilities';

import {I18nState} from './i18n';
import {LhsViewState} from './lhs';
import {RhsViewState} from './rhs';

import {DraggingState} from '.';

export type ModalFilters = {
    roles?: string[];
    channel_roles?: string[];
    team_roles?: string[];
};

export type ViewsState = {
    admin: {
        navigationBlock: {
            blocked: boolean;
            onNavigationConfirmed: () => void;
            showNavigationPrompt: boolean;
        };
        needsLoggedInLimitReachedCheck: boolean;
    };

    announcementBar: {
        announcementBarState: {
            announcementBarCount: number;
        };
    };

    browser: {
        focused: boolean;
        windowSize: string;
    };

    channel: {
        postVisibility: {
            [channelId: string]: number;
        };
        lastChannelViewTime: {
            [channelId: string]: number;
        };
        loadingPost: {
            [channelId: string]: boolean;
        };
        focusedPostId: string;
        mobileView: boolean;
        lastUnreadChannel: (Channel & {hadMentions: boolean}) | null; // Actually only an object with {id: string, hadMentions: boolean}
        lastGetPosts: {
            [channelId: string]: number;
        };
        channelPrefetchStatus: {
            [channelId: string]: string;
        };
        toastStatus: boolean;
    };

    drafts: {
        remotes: {
            [storageKey: string]: boolean;
        };
    };

    rhs: RhsViewState;

    rhsSuppressed: boolean;

    posts: {
        editingPost: {
            postId: string;
            show: boolean;
            isRHS: boolean;
        };
        menuActions: {
            [postId: string]: {
                [actionId: string]: {
                    text: string;
                    value: string;
                };
            };
        };
    };

    modals: {
        modalState: {
            [modalId: string]: {
                open: boolean;
                dialogProps: Record<string, any>;
                dialogType: React.ComponentType;
            };
        };
        showLaunchingWorkspace: boolean;
    };

    emoji: {
        emojiPickerCustomPage: number;
        shortcutReactToLastPostEmittedFrom: string;
    };

    i18n: I18nState;

    lhs: LhsViewState;

    search: {
        modalSearch: string;
        popoverSearch: string;
        channelMembersRhsSearch: string;
        modalFilters: ModalFilters;
        systemUsersSearch: {
            term: string;
            team: string;
            filter: string;
        };
        userGridSearch: {
            term: string;
            filters: {
                roles?: string[];
                channel_roles?: string[];
                team_roles?: string[];
            };
        };
        teamListSearch: string;
        channelListSearch: {
            term: string;
            filters: {
                public?: boolean;
                private?: boolean;
                deleted?: boolean;
                team_ids?: string[];
            };
        };
    };

    notice: {
        hasBeenDismissed: {
            [message: string]: boolean;
        };
    };

    system: {
        websocketConnectionErrorCount: number;
    };

    channelSelectorModal: {
        channels: string[];
    };

    settings: {
        activeSection: string;
        previousActiveSection: string;
    };

    marketplace: {
        plugins: MarketplacePlugin[];
        apps: MarketplaceApp[];
        installing: {[id: string]: boolean};
        errors: {[id: string]: string};
        filter: string;
    };

    productMenu: {
        switcherOpen: boolean;
    };

    channelSidebar: {
        unreadFilterEnabled: boolean;
        draggingState: DraggingState;
        newCategoryIds: string[];
        multiSelectedChannelIds: string[];
        lastSelectedChannel: string;
        firstChannelName: string;
    };

    statusDropdown: {
        isOpen: boolean;
    };

    addChannelDropdown: {
        isOpen: boolean;
    };

    addChannelCtaDropdown: {
        isOpen: boolean;
    };

    onboardingTasks: {
        isShowOnboardingTaskCompletion: boolean;
        isShowOnboardingCompleteProfileTour: boolean;
        isShowOnboardingVisitConsoleTour: boolean;
    };

    threads: {
        selectedThreadIdInTeam: RelationOneToOne<Team, UserThread['id'] | null>;
        lastViewedAt: {[id: string]: number};
        manuallyUnread: {[id: string]: boolean};
        toastStatus: boolean;
    };

    textbox: {
        shouldShowPreviewOnCreateComment: boolean;
        shouldShowPreviewOnCreatePost: boolean;
        shouldShowPreviewOnEditChannelHeaderModal: boolean;
        shouldShowPreviewOnEditPostModal: boolean;
    };
};
