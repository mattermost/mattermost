// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * A list mapping IDs or CSS classes to regions of the app. In case of nested regions, these are sorted deepest-first.
 *
 * The region names map to values of model.AcceptedLCPRegions on the server.
 */
const elementIdentifiers = [

    // Post list
    ['post__content', 'post'],
    ['create_post', 'post_textbox'],

    // LHS
    ['SidebarContainer', 'channel_sidebar'],
    ['team-sidebar', 'team_sidebar'],

    // Header
    ['channel-header', 'channel_header'],
    ['global-header', 'global_header'],
    ['announcement-bar', 'announcement_bar'],

    // Areas of the app
    ['channel_view', 'center_channel'],
    ['modal-content', 'modal_content'],
] as const satisfies Array<[string, string]>;

export type ElementIdentifier = 'other' | typeof elementIdentifiers[number][1];

export function identifyElementRegion(element: Element): ElementIdentifier {
    let currentElement: Element | null = element;

    while (currentElement) {
        for (const identifier of elementIdentifiers) {
            if (currentElement.id === identifier[0] || currentElement.classList.contains(identifier[0])) {
                return identifier[1];
            }
        }

        currentElement = currentElement.parentElement;
    }

    return 'other';
}
