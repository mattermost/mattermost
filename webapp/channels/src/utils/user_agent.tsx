// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export * from '@mattermost/shared/utils/user_agent';
export {isEdge as isChromiumEdge} from '@mattermost/shared/utils/user_agent';

export function isInternetExplorer(): boolean {
    return window.navigator.userAgent.indexOf('Trident') !== -1;
}

export function isEdge(): boolean {
    return window.navigator.userAgent.indexOf('Edge') !== -1;
}
