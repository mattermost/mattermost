// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {General} from 'mattermost-redux/constants';

import type {GlobalState} from 'types/store';

import {canViewPermalinkPreview} from './posts';

describe('Selectors.Posts', () => {
    describe('canViewPermalinkPreview (MM-67130)', () => {
        const baseState = {
            entities: {
                general: {
                    config: {
                        EnableCompliance: 'false',
                    },
                },
                users: {
                    currentUserId: 'user1',
                },
                channels: {
                    channels: {
                        publicChannel: {id: 'publicChannel', team_id: 'team1', type: General.OPEN_CHANNEL, delete_at: 0},
                        privateChannel: {id: 'privateChannel', team_id: 'team1', type: General.PRIVATE_CHANNEL, delete_at: 0},
                        dmChannel: {id: 'dmChannel', team_id: '', type: General.DM_CHANNEL, delete_at: 0},
                        deletedPublicChannel: {id: 'deletedPublicChannel', team_id: 'team1', type: General.OPEN_CHANNEL, delete_at: 12345},
                    },
                    myMembers: {},
                },
                teams: {
                    membersInTeam: {},
                },
            },
        } as unknown as GlobalState;

        describe('should deny access when user lacks permission', () => {
            it('should return false for private channel when user is not a member', () => {
                expect(canViewPermalinkPreview(baseState, 'privateChannel', General.PRIVATE_CHANNEL)).toBe(false);
            });

            it('should return false for DM channel when user is not a member', () => {
                expect(canViewPermalinkPreview(baseState, 'dmChannel', General.DM_CHANNEL)).toBe(false);
            });

            it('should return false for public channel when user is not a team member', () => {
                expect(canViewPermalinkPreview(baseState, 'publicChannel', General.OPEN_CHANNEL)).toBe(false);
            });

            it('should return false for deleted public channel even if user is a team member', () => {
                const state = {
                    entities: {
                        ...baseState.entities,
                        teams: {
                            membersInTeam: {
                                team1: {user1: {}},
                            },
                        },
                    },
                } as unknown as GlobalState;
                expect(canViewPermalinkPreview(state, 'deletedPublicChannel', General.OPEN_CHANNEL)).toBe(false);
            });

            it('should return false for public channel when compliance is enabled (even if user is team member)', () => {
                const state = {
                    entities: {
                        ...baseState.entities,
                        general: {
                            config: {
                                EnableCompliance: 'true',
                            },
                        },
                        teams: {
                            membersInTeam: {
                                team1: {user1: {}},
                            },
                        },
                    },
                } as unknown as GlobalState;
                expect(canViewPermalinkPreview(state, 'publicChannel', General.OPEN_CHANNEL)).toBe(false);
            });
        });

        describe('should allow access when user has permission', () => {
            it('should return true when user is a channel member', () => {
                const state = {
                    entities: {
                        ...baseState.entities,
                        channels: {
                            ...baseState.entities.channels,
                            myMembers: {
                                privateChannel: {},
                            },
                        },
                    },
                } as unknown as GlobalState;
                expect(canViewPermalinkPreview(state, 'privateChannel', General.PRIVATE_CHANNEL)).toBe(true);
            });

            it('should return true for public channel when user is a team member (but not channel member)', () => {
                const state = {
                    entities: {
                        ...baseState.entities,
                        teams: {
                            membersInTeam: {
                                team1: {user1: {}},
                            },
                        },
                    },
                } as unknown as GlobalState;
                expect(canViewPermalinkPreview(state, 'publicChannel', General.OPEN_CHANNEL)).toBe(true);
            });
        });
    });
});
