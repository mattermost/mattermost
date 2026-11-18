// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

declare module 'js-yaml' {
    export function load(text: string): unknown;
    const yaml: {load: typeof load};
    export default yaml;
}
