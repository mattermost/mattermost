// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ResolvedTestcontainersConfig} from '@/config';

/**
 * Validate that the requested dependencies are consistent and requirements are met.
 * Throws descriptive errors for invalid combinations.
 */
export function validateDependencies(dependencies: string[], config: ResolvedTestcontainersConfig): void {
    const hasElasticsearch = dependencies.includes('elasticsearch');
    const hasOpensearch = dependencies.includes('opensearch');
    const hasDejavu = dependencies.includes('dejavu');
    const hasLoki = dependencies.includes('loki');
    const hasPromtail = dependencies.includes('promtail');
    const hasGrafana = dependencies.includes('grafana');
    const hasPrometheus = dependencies.includes('prometheus');
    const hasRedis = dependencies.includes('redis');
    const isTeamEdition = config.server.edition === 'team';

    // Only one search engine can be enabled at a time
    if (hasElasticsearch && hasOpensearch) {
        throw new Error(
            'Cannot enable both elasticsearch and opensearch. Only one search engine can be used at a time.',
        );
    }

    // Dejavu requires a search engine
    if (hasDejavu && !hasElasticsearch && !hasOpensearch) {
        throw new Error(
            'Cannot enable dejavu without a search engine. Enable elasticsearch or opensearch with dejavu.',
        );
    }

    // Promtail and loki must be enabled together
    if (hasPromtail && !hasLoki) {
        throw new Error('Cannot enable promtail without loki. Promtail requires Loki to send logs to.');
    }
    if (hasLoki && !hasPromtail) {
        throw new Error('Cannot enable loki without promtail. Enable both for log aggregation: -D loki,promtail');
    }

    // Grafana requires at least one data source
    if (hasGrafana && !hasPrometheus && !hasLoki) {
        throw new Error(
            'Cannot enable grafana without a data source. Enable prometheus and/or loki,promtail with grafana.',
        );
    }

    // Redis requires a license with clustering support
    if (hasRedis && (isTeamEdition || !process.env.MM_LICENSE)) {
        throw new Error(
            'Cannot enable redis without MM_LICENSE. Redis requires a Mattermost license with clustering support (not available in team edition).',
        );
    }

    // HA mode requires a license with clustering support
    if (config.server.ha && (isTeamEdition || !process.env.MM_LICENSE)) {
        throw new Error(
            'Cannot enable HA mode without MM_LICENSE. HA mode requires a Mattermost license with clustering support (not available in team edition).',
        );
    }

    // Entry tier is only applicable to enterprise and fips editions
    if (config.server.entry && isTeamEdition) {
        throw new Error(
            'Cannot use --entry (or TC_ENTRY=true) with team edition. Entry tier is only applicable to enterprise and fips editions.',
        );
    }
}
