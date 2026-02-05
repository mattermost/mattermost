// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Re-export types from connected component
export type {PropsFromRedux} from './connected_team_sidebar';

// Default export is the wrapper that conditionally renders Guilded or standard sidebar
export {default} from './team_sidebar_wrapper';
