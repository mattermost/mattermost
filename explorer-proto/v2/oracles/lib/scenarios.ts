// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/** SYNTHETIC injected faults used to measure oracle detection. None of these is a product bug. */
export type Scenario = {
    id: string;
    title: string;
    /** proxy: fault layer in front of the forwarder; page-script: injected into the page; fixture: local static page. */
    kind: 'proxy' | 'page-script' | 'fixture';
    faultConfig?: string;
    traversal: string;
    /** Action index at which the fault first becomes observable (0 = from the initial load). */
    trigger_action: number;
    /** oracle '*' means: counts as detected if any new finding appears. */
    expect: {oracle: string; class: string; evidence_includes?: string};
    /**
     * proxy scenarios: 'direct' (default) makes the oracle read REST from the unfaulted forwarder;
     * 'via-fault-layer' sends the oracle's REST read through the same fault layer as the UI.
     */
    rest?: 'direct' | 'via-fault-layer';
    /** Needs the bookmarks session seed (a licensed server). */
    session?: 'bookmarks';
};

export const SCENARIOS: Scenario[] = [
    {
        id: 'F1-drop-channel-display-name',
        title: 'display_name removed from the channels list response (sidebar name vs REST)',
        kind: 'proxy',
        faultConfig: 'f1-drop-channel-display-name.json',
        traversal: 'T1-sidebar-channels',
        trigger_action: 0,
        expect: {oracle: 'O-UIREST', class: 'ui-rest-mismatch', evidence_includes: 'channel-display-name-vs-rest'},
    },
    {
        id: 'F2-posts-fetch-500',
        title: 'HTTP 500 on every posts fetch',
        kind: 'proxy',
        faultConfig: 'f2-posts-fetch-500.json',
        traversal: 'T1-sidebar-channels',
        trigger_action: 0,
        expect: {oracle: 'O-NET', class: 'http-5xx', evidence_includes: '/posts'},
    },
    {
        id: 'F3-ws-delay-channel-updated',
        title: 'channel_updated WebSocket event delayed 6 s (UI stale after a REST change)',
        kind: 'proxy',
        faultConfig: 'f3-ws-delay-channel-updated.json',
        traversal: 'W-header-update',
        trigger_action: 2,
        expect: {oracle: 'O-UIREST', class: 'ui-rest-mismatch', evidence_includes: 'channel-purpose-header-vs-rest'},
    },
    {
        id: 'S4-aria-dangling-reference',
        title: 'aria-labelledby with a dangling id injected by a DOM mutation script (oracle self-test, MM-71785 class)',
        kind: 'page-script',
        traversal: 'T1-sidebar-channels',
        trigger_action: 0,
        expect: {oracle: 'O-A11Y', class: 'dangling-aria-reference', evidence_includes: 'synthetic-missing-label-id'},
    },
    {
        id: 'S5-console-error',
        title: 'console.error injected by a page script at action 2 (oracle self-test)',
        kind: 'page-script',
        traversal: 'T1-sidebar-channels',
        trigger_action: 2,
        expect: {oracle: 'O-CONSOLE', class: 'console-error', evidence_includes: 'SYNTHETIC injected console error'},
    },
    {
        id: 'S6-modal-enter-while-disabled',
        title: 'dialog whose Enter key submits while the confirm button is disabled (local static fixture, oracle self-test)',
        kind: 'fixture',
        traversal: 'fixture',
        trigger_action: 1,
        expect: {oracle: 'O-MODAL', class: 'enter-submits-while-disabled'},
    },
    {
        id: 'F7-ws-drop-channel-updated',
        title: 'channel_updated WebSocket event dropped without a sequence gap (UI stale after a REST change)',
        kind: 'proxy',
        faultConfig: 'f7-ws-drop-channel-updated.json',
        traversal: 'W-header-update',
        trigger_action: 2,
        expect: {oracle: 'O-UIREST', class: 'ui-rest-mismatch', evidence_includes: 'channel-purpose-header-vs-rest'},
    },
    {
        id: 'F8b-drop-bookmark-title-rest-direct',
        title: 'display_name removed from the bookmarks response, oracle reads REST directly from the unfaulted server (bookmark bar title vs REST; bookmarks session seed)',
        kind: 'proxy',
        faultConfig: 'f8-drop-bookmark-title.json',
        traversal: 'T1-sidebar-channels',
        trigger_action: 0,
        expect: {oracle: 'O-UIREST', class: 'ui-rest-mismatch', evidence_includes: 'bookmark-titles-vs-rest'},
        session: 'bookmarks',
    },
    {
        id: 'F8a-drop-bookmark-title-shared-endpoint',
        title: 'display_name removed from the bookmarks response while the oracle reads the same endpoint through the same fault layer (bookmarks session seed; expected blind spot)',
        kind: 'proxy',
        faultConfig: 'f8-drop-bookmark-title.json',
        traversal: 'T1-sidebar-channels',
        trigger_action: 0,
        expect: {oracle: 'O-UIREST', class: 'ui-rest-mismatch', evidence_includes: 'bookmark-titles-vs-rest'},
        rest: 'via-fault-layer',
        session: 'bookmarks',
    },
    {
        id: 'F9-http-delay-channels',
        title: 'channels list response delayed 3 s (latency; no oracle is designed for slowness, so a miss is the expected outcome)',
        kind: 'proxy',
        faultConfig: 'f9-http-delay-channels.json',
        traversal: 'T1-sidebar-channels',
        trigger_action: 0,
        expect: {oracle: '*', class: '*'},
    },
];
