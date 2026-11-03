// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

declare module '*.css';
declare module '*.scss';

// Maps to a .css file through the package's exports map, so the '*.css' pattern above can't match it.
declare module '@mattermost/compass-ui/styles';
