// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const MOBILE_SCREEN_WIDTH = 768;

export const isMobile = () => {
    return window.innerWidth <= MOBILE_SCREEN_WIDTH;
};
