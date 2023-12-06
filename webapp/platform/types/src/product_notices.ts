// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export enum Action {
    URL = 'url',
}

export type ProductNotice = {

    /** Unique identifier for this notice. Can be a running number. Used for storing 'viewed' state on the server. */
    id: string;

    /** Notice title. Use {{Mattermost}} instead of plain text to support white-labeling. Text supports Markdown. */
    title: string;

    /** Notice content. Use {{Mattermost}} instead of plain text to support white-labeling. Text supports Markdown. */
    description: string;
    image?: string;

    /** Optional override for the action button text (defaults to OK) */
    actionText?: string;

    /** Optional action to perform on action button click. (defaults to closing the notice) */
    action?: Action;

    /** Optional action parameter.
     * Example: {"action": "url", actionParam: "/console/some-page"}
     */
    actionParam?: string;

    sysAdminOnly: boolean;
    teamAdminOnly: boolean;
}

/** List of product notices. Order is important and is used to resolve priorities.
 * Each notice will only be show if conditions are met.
 */
export type ProductNotices = ProductNotice[];
