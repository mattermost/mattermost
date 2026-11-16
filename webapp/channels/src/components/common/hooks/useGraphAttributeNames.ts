// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useMemo, useState} from 'react';

import {supportsHierarchy} from '@mattermost/types/properties';

import type {ResolvedChannelAttribute} from 'mattermost-redux/selectors/entities/properties';

import {asGraphFieldRef, asGraphValueIds} from 'components/property_fields/graph';
import {assignmentFallbackLabels} from 'components/property_fields/graph/assignment_prefetch';
import {ensureGraphOptionNames, getGraphOptionNames, subscribeGraphOptionNames} from 'components/property_fields/graph/use_graph_option_names';

function valueIds(attribute: ResolvedChannelAttribute): string[] {
    return asGraphValueIds(attribute.value?.value as string | string[] | undefined);
}

/**
 * Channel attributes with graph values shown as option names rather than raw
 * ids. The redux selector is pure and cannot fetch, so ids it could not name
 * from the field's inline options are named here from the module-level cache,
 * fetching once per field on demand. Until a name arrives — or after a fetch
 * that failed — the raw id shows.
 */
export default function useGraphAttributeNames(attributes: ResolvedChannelAttribute[]): ResolvedChannelAttribute[] {
    const [cacheEpoch, setCacheEpoch] = useState(0);

    useEffect(() => {
        return subscribeGraphOptionNames(() => setCacheEpoch((epoch) => epoch + 1));
    }, []);

    useEffect(() => {
        for (const attribute of attributes) {
            if (!supportsHierarchy(attribute.field)) {
                continue;
            }
            const ids = valueIds(attribute);
            if (ids.length > 0) {
                ensureGraphOptionNames(asGraphFieldRef(attribute.field), ids);
            }
        }

        // cacheEpoch re-runs this after a field's names are discarded, so the
        // replacement fetch starts without waiting for the attributes to change.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [attributes, cacheEpoch]);

    return useMemo(() => {
        let rewritten: ResolvedChannelAttribute[] | undefined;

        attributes.forEach((attribute, index) => {
            if (!supportsHierarchy(attribute.field)) {
                return;
            }
            const ids = valueIds(attribute);
            if (ids.length === 0) {
                return;
            }

            const ref = asGraphFieldRef(attribute.field);
            const names = {...assignmentFallbackLabels(ref), ...getGraphOptionNames(ref.id).names};
            const displayValues = ids.map((id) => names[id] ?? id);
            const unresolved = ids.filter((id) => names[id] === undefined);

            const next: ResolvedChannelAttribute = {
                ...attribute,
                displayValue: displayValues.join(', '),
                displayValues,
            };
            if (unresolved.length > 0) {
                next.unresolvedOptionIds = unresolved;
            } else {
                delete next.unresolvedOptionIds;
            }

            rewritten = rewritten ?? attributes.slice();
            rewritten[index] = next;
        });

        return rewritten ?? attributes;

        // cacheEpoch stands in for the module-level name cache this memo reads.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [attributes, cacheEpoch]);
}
