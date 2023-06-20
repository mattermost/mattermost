// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Channel} from '@mattermost/types/channels';
import {Scheme} from '@mattermost/types/schemes';
import {Team} from '@mattermost/types/teams';

import deepFreezeAndThrowOnMutation from 'mattermost-redux/utils/deep_freeze';
import TestHelper from '../../../test/test_helper';
import * as Selectors from 'mattermost-redux/selectors/entities/schemes';
import {ScopeTypes} from 'mattermost-redux/constants/schemes';

describe('Selectors.Schemes', () => {
    const scheme1 = TestHelper.mockSchemeWithId();
    scheme1.scope = ScopeTypes.CHANNEL as 'channel';

    const scheme2 = TestHelper.mockSchemeWithId();
    scheme2.scope = ScopeTypes.TEAM as 'team';

    const schemes: Record<string, Scheme> = {};
    schemes[scheme1.id] = scheme1;
    schemes[scheme2.id] = scheme2;

    const channel1 = TestHelper.fakeChannelWithId('');
    channel1.scheme_id = scheme1.id;

    const channel2 = TestHelper.fakeChannelWithId('');

    const channels: Record<string, Channel> = {};
    channels[channel1.id] = channel1;
    channels[channel2.id] = channel2;

    const team1 = TestHelper.fakeTeamWithId();
    team1.scheme_id = scheme2.id;

    const team2 = TestHelper.fakeTeamWithId();

    const teams: Record<string, Team> = {};
    teams[team1.id] = team1;
    teams[team2.id] = team2;

    const testState = deepFreezeAndThrowOnMutation({
        entities: {
            schemes: {schemes},
            channels: {channels},
            teams: {teams},
        },
    });

    it('getSchemes', () => {
        expect(Selectors.getSchemes(testState)).toEqual(schemes);
    });

    it('getScheme', () => {
        expect(Selectors.getScheme(testState, scheme1.id)).toEqual(scheme1);
    });

    it('makeGetSchemeChannels', () => {
        const getSchemeChannels = Selectors.makeGetSchemeChannels();
        const results = getSchemeChannels(testState, {schemeId: scheme1.id});
        expect(results.length).toEqual(1);
        expect(results[0].name).toEqual(channel1.name);
    });

    it('makeGetSchemeChannels with team scope scheme', () => {
        const getSchemeChannels = Selectors.makeGetSchemeChannels();
        const results = getSchemeChannels(testState, {schemeId: scheme2.id});
        expect(results.length).toEqual(0);
    });

    it('makeGetSchemeTeams', () => {
        const getSchemeTeams = Selectors.makeGetSchemeTeams();
        const results = getSchemeTeams(testState, {schemeId: scheme2.id});
        expect(results.length).toEqual(1);
        expect(results[0].name).toEqual(team1.name);
    });

    it('getSchemeTeams with channel scope scheme', () => {
        const getSchemeTeams = Selectors.makeGetSchemeTeams();
        const results = getSchemeTeams(testState, {schemeId: scheme1.id});
        expect(results.length).toEqual(0);
    });
});
