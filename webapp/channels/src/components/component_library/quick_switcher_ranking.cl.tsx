// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';

import {
    PLAYGROUND_NOW,
    SCENARIO_PRESETS,
    WEIGHT_PRESETS,
} from './quick_switcher_ranking_presets';

import {
    DEFAULT_RANK_PENALTY_WEIGHTS,
    rankingDebugRows,
    validatePenaltyDominance,
} from '../suggestion/quick_switch_ranking';
import type {RankPenaltyWeights} from '../suggestion/quick_switch_ranking';

import './component_library.scss';

type Props = {
    backgroundClass: string;
};

type WeightKey = keyof Omit<RankPenaltyWeights, 'recentActivityWindowMs'>;

const WEIGHT_FIELDS: Array<{key: WeightKey; label: string}> = [
    {key: 'archived', label: 'archived'},
    {key: 'deactivated', label: 'deactivated'},
    {key: 'nonPrefixMatch', label: 'nonPrefixMatch'},
    {key: 'channel', label: 'channel (type)'},
    {key: 'groupMessage', label: 'groupMessage'},
    {key: 'noActivity', label: 'noActivity'},
    {key: 'staleActivity', label: 'staleActivity'},
    {key: 'hiddenInSidebar', label: 'hiddenInSidebar'},
];

export default function QuickSwitcherRankingComponentLibrary({backgroundClass}: Props) {
    const [scenarioId, setScenarioId] = useState(SCENARIO_PRESETS[0].id);
    const [weightPresetId, setWeightPresetId] = useState(WEIGHT_PRESETS[0].id);
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

    const onSelectWeightPreset = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const next = WEIGHT_PRESETS.find((preset) => preset.id === e.target.value) || WEIGHT_PRESETS[0];
        setWeightPresetId(next.id);
        setWeights({...next.weights});
    }, []);

    const onWeightChange = useCallback((key: WeightKey, value: string) => {
        const parsed = Number(value);
        if (Number.isNaN(parsed)) {
            return;
        }
        setWeightPresetId('custom');
        setWeights((prev) => ({...prev, [key]: parsed}));
    }, []);

    const onResetWeights = useCallback(() => {
        setWeightPresetId(WEIGHT_PRESETS[0].id);
        setWeights({...DEFAULT_RANK_PENALTY_WEIGHTS});
    }, []);

    const warnings = useMemo(() => validatePenaltyDominance(weights), [weights]);

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

            <label className='clInput'>
                {'Weight preset: '}
                <select
                    value={weightPresetId}
                    onChange={onSelectWeightPreset}
                >
                    {WEIGHT_PRESETS.map((preset) => (
                        <option
                            key={preset.id}
                            value={preset.id}
                        >
                            {preset.label}
                        </option>
                    ))}
                    {weightPresetId === 'custom' && (
                        <option value='custom'>
                            {'Custom'}
                        </option>
                    )}
                </select>
                {' '}
                <button
                    type='button'
                    onClick={onResetWeights}
                >
                    {'Reset weights'}
                </button>
            </label>

            <p className='clJsonHint'>
                {(WEIGHT_PRESETS.find((preset) => preset.id === weightPresetId) || WEIGHT_PRESETS[0]).description}
            </p>

            <div className='clWrapper'>
                {WEIGHT_FIELDS.map(({key, label}) => (
                    <label
                        key={key}
                        className='clInput'
                    >
                        {`${label}: `}
                        <input
                            type='number'
                            value={weights[key]}
                            onChange={(e) => onWeightChange(key, e.target.value)}
                        />
                    </label>
                ))}
                <label className='clInput'>
                    {'recent window (days): '}
                    <input
                        type='number'
                        value={weights.recentActivityWindowMs / DAY_MS}
                        onChange={(e) => {
                            const days = Number(e.target.value);
                            if (Number.isNaN(days)) {
                                return;
                            }
                            setWeightPresetId('custom');
                            setWeights((prev) => ({
                                ...prev,
                                recentActivityWindowMs: days * DAY_MS,
                            }));
                        }}
                    />
                </label>
            </div>

            {warnings.length > 0 && (
                <div className='clJsonError'>
                    <strong>{'Dominance warnings'}</strong>
                    <ul>
                        {warnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                        ))}
                    </ul>
                </div>
            )}

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
