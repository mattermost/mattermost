// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const GRAPH_MAX_PARENTS_PER_VALUE = 100;
export const GRAPH_MAX_DEPTH = 100;
export const GRAPH_MAX_OPTIONS = 100_000;
export const GRAPH_MAX_EDGES = 1_000_000;

// Cap for picker search rows. Tree expansion is separately budgeted;
// an uncapped substring match on GRAPH_MAX_OPTIONS would freeze the menu.
export const GRAPH_MAX_SEARCH_ROWS = 200;
