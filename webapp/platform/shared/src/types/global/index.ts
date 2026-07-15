// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PublishedEditorUtils} from './editor';
import type {PublishedModalUtils} from './modals';

export * from './modals';
export * from './editor';
export * from './suggestions';

// Lets plugins type the window global without reaching into channels internals.
// Grows as more of channels' WindowWithLibraries surface migrates here.
export type WindowShared = {
    WebappUtils: {
        modals: PublishedModalUtils;
        editor: PublishedEditorUtils;
    };
};
