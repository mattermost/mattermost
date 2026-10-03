// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';

import {
    PLAYGROUND_NOW,
    SCENARIO_PRESETS,
} from './quick_switcher_ranking_presets';

import {
    DEFAULT_RANK_PENALTY_WEIGHTS,
    rankingDebugRows,
} from '../suggestion/quick_switch_ranking';
import type {RankPenaltyWeights} from '../suggestion/quick_switch_ranking';

import './component_library.scss';

type Props = {
    backgroundClass: string;
};

type WeightKey = keyof Omit<RankPenaltyWeights, 'recentActivityWindowMs'>;

const WEIGHT_FIELDS: Array<{key: WeightKey; label: string; description: string}> = [
    {key: 'archived', label: 'archived', description: 'Channel is archived (delete_at set).'},
    {key: 'deactivated', label: 'deactivated', description: 'DM peer account is deactivated.'},
    {key: 'nonPrefixMatch', label: 'nonPrefixMatch', description: 'Display name / name does not start with the search term.'},
    {key: 'channel', label: 'channel (type)', description: 'Open/private/etc. channel (not DM/GM).'},
    {key: 'groupMessage', label: 'groupMessage', description: 'Group message. DMs get 0 type penalty.'},
    {key: 'noActivity', label: 'noActivity', description: 'Never opened (no last_viewed_at).'},
    {key: 'staleActivity', label: 'staleActivity', description: 'Last viewed older than the recent window.'},
    {key: 'hiddenInSidebar', label: 'hiddenInSidebar', description: 'Group message not shown in the channel sidebar (user has not marked it visible). Still searchable in Find Channels, but ranked slightly below an otherwise equal visible GM.'},
];

export default function QuickSwitcherRankingComponentLibrary({backgroundClass}: Props) {
    const [scenarioId, setScenarioId] = useState(SCENARIO_PRESETS[0].id);
    const [searchTerm, setSearchTerm] = useState(SCENARIO_PRESETS[0].defaultSearch);
    const [weights, setWeights] = useState<RankPenaltyWeights>({...DEFAULT_RANK_PENALTY_WEIGHTS});

    const scenario = useMemo(
        () => SCENARIO_PRESETS.find((preset) => preset.id === scenarioId) || SCENARIO_PRESETS[0],
        [scenarioId],
    );

    const onSelectScenario = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const next = SCENARIO_PRESETS.find((preset) => preset.id === e.target.value) || SCENARIO_PRESETS[0];
        setScenarioId(next.id);
        setSearchTerm(next.defaultSearch);
    }, []);

    const onWeightChange = useCallback((key: WeightKey, value: string) => {
        const parsed = Number(value);
        if (Number.isNaN(parsed)) {
            return;
        }
        setWeights((prev) => ({...prev, [key]: parsed}));
    }, []);

    const onResetWeights = useCallback(() => {
        setWeights({...DEFAULT_RANK_PENALTY_WEIGHTS});
    }, []);

    const rows = useMemo(
        () => rankingDebugRows(searchTerm, scenario.channels, weights, scenario.now || PLAYGROUND_NOW),
        [searchTerm, scenario, weights],
    );

    return (
        <div className={backgroundClass}>
            <label className='clInput'>
                {'Scenario: '}
                <select
                    value={scenarioId}
                    onChange={onSelectScenario}
                >
                    {SCENARIO_PRESETS.map((preset) => (
                        <option
                            key={preset.id}
                            value={preset.id}
                        >
                            {preset.label}
                        </option>
                    ))}
                </select>
            </label>

            <p className='clJsonHint'>
                {scenario.description}
            </p>

            <label className='clInput'>
                {'Search term: '}
                <input
                    type='text'
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </label>

            <h3>{'Penalty weights'}</h3>
            <p className='clJsonHint'>
                {'Each match gets additive penalties (lower total ranks higher). '}
                {'Only matching conditions apply — a recent prefix DM typically scores 0. '}
                {'Type penalties are mutually exclusive (DM = 0, GM = groupMessage, else channel). '}
                {'Activity is also exclusive (recent = 0, stale = staleActivity, never = noActivity).'}
            </p>
            <p>
                <button
                    type='button'
                    onClick={onResetWeights}
                >
                    {'Reset to defaults'}
                </button>
            </p>

            <div className='clWrapper'>
                {WEIGHT_FIELDS.map(({key, label, description}) => (
                    <label
                        key={key}
                        className='clInput'
                        title={description}
                    >
                        {`${label}: `}
                        <input
                            type='number'
                            value={weights[key]}
                            onChange={(e) => onWeightChange(key, e.target.value)}
                        />
                        <span className='clJsonHint'>{` — ${description}`}</span>
                    </label>
                ))}
                <label
                    className='clInput'
                    title='Views within this many days count as recent (activity penalty 0).'
                >
                    {'recent window (days): '}
                    <input
                        type='number'
                        value={weights.recentActivityWindowMs / DAY_MS}
                        onChange={(e) => {
                            const days = Number(e.target.value);
                            if (Number.isNaN(days)) {
                                return;
                            }
                            setWeights((prev) => ({
                                ...prev,
                                recentActivityWindowMs: days * DAY_MS,
                            }));
                        }}
                    />
                    <span className='clJsonHint'>
                        {' — Views within this window count as recent (activity penalty 0).'}
                    </span>
                </label>
            </div>

            <h3>{`Ordered results (${rows.length})`}</h3>
            <table className='clTable'>
                <thead>
                    <tr>
                        <th>{'#'}</th>
                        <th>{'Label'}</th>
                        <th>{'Type'}</th>
                        <th>{'Rank'}</th>
                        <th>{'Arch'}</th>
                        <th>{'Deact'}</th>
                        <th>{'!Pref'}</th>
                        <th>{'TypeΔ'}</th>
                        <th>{'Act'}</th>
                        <th>{'Hid'}</th>
                        <th>{'Prefix?'}</th>
                        <th>{'last_viewed_at'}</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, index) => (
                        <tr key={row.id}>
                            <td>{index + 1}</td>
                            <td>{row.name}</td>
                            <td>{row.channelType}</td>
                            <td>{row.rank}</td>
                            <td>{row.archived}</td>
                            <td>{row.deactivated}</td>
                            <td>{row.nonPrefixMatch}</td>
                            <td>{row.conversationType}</td>
                            <td>{row.activity}</td>
                            <td>{row.hiddenInSidebar}</td>
                            <td>{row.isPrefixMatch ? 'yes' : 'no'}</td>
                            <td>{row.last_viewed_at}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <h3>{'Candidate set'}</h3>
            <table className='clTable'>
                <thead>
                    <tr>
                        <th>{'id'}</th>
                        <th>{'display_name'}</th>
                        <th>{'name'}</th>
                        <th>{'type'}</th>
                        <th>{'last_viewed_at'}</th>
                        <th>{'flags'}</th>
                    </tr>
                </thead>
                <tbody>
                    {scenario.channels.map((channel) => (
                        <tr key={channel.channel.id}>
                            <td>{channel.channel.id}</td>
                            <td>{channel.channel.display_name}</td>
                            <td>{channel.name}</td>
                            <td>{channel.channel.type}</td>
                            <td>{channel.last_viewed_at ? new Date(channel.last_viewed_at).toISOString() : 'never'}</td>
                            <td>
                                {[
                                    channel.deactivated ? 'deactivated' : null,
                                    channel.hiddenInSidebar ? 'hidden' : null,
                                    channel.channel.delete_at ? 'archived' : null,
                                ].filter(Boolean).join(', ') || '—'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

const DAY_MS = 24 * 60 * 60 * 1000;
