// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useState, useEffect, useCallback} from 'react';
import {useDispatch} from 'react-redux';

import type {AccessControlAttribute} from '@mattermost/types/access_control';

import {getChannelAccessControlAttributes} from 'mattermost-redux/actions/channels';

// Define supported entity types
export enum EntityType {
    Channel = 'channel',

    // more entity types will be added here in the future
}

// ProcessedAttributes is the shape that components consume: a structured
// dictionary of attribute -> values (used for the policy banners) plus a flat
// tag array (kept for backwards compatibility with consumers that only need
// the values without their owning attribute).
type ProcessedAttributes = {
    attributeTags: string[];
    structuredAttributes: AccessControlAttribute[];
};

// Module-level cache for access control attributes. The cache stores already
// processed data with a timestamp to implement a short TTL.
const attributesCache: Record<string, {
    processedData: ProcessedAttributes;
    timestamp: number;
}> = {};

// Cache TTL in milliseconds (5 minutes).
const CACHE_TTL = 5 * 60 * 1000;

// Array of supported entity types for validation
const SUPPORTED_ENTITY_TYPES = Object.values(EntityType);

const EMPTY_PROCESSED: ProcessedAttributes = {
    attributeTags: [],
    structuredAttributes: [],
};

// processAttributeData converts the server response (a dictionary keyed by
// attribute name with arrays of literal values) into the structured form
// consumed by the UI. The dictionary preserves both the attribute name and
// the values associated with it so each tag can be displayed alongside its
// originating attribute.
function processAttributeData(data: Record<string, string[]> | undefined | null): ProcessedAttributes {
    if (!data) {
        return EMPTY_PROCESSED;
    }

    const attributeTags: string[] = [];
    const structuredAttributes: AccessControlAttribute[] = [];

    // Format: { "attributeName": ["value1", "value2"], "anotherAttribute": ["value3"] }
    for (const [name, values] of Object.entries(data)) {
        if (!Array.isArray(values)) {
            continue;
        }

        structuredAttributes.push({name, values: [...values]});

        for (const value of values) {
            if (value !== undefined && value !== null) {
                attributeTags.push(value);
            }
        }
    }

    return {attributeTags, structuredAttributes};
}

/**
 * Invalidates the cached attributes for a single entity. Components that
 * mutate the underlying access policy should call this to ensure the next
 * read fetches fresh data instead of serving up to CACHE_TTL milliseconds of
 * stale state.
 */
export function invalidateAccessControlAttributesCache(entityType: EntityType, entityId: string): void {
    delete attributesCache[`${entityType}:${entityId}`];
}

/**
 * A hook for fetching access control attributes for an entity
 *
 * @param entityType - The type of entity (e.g., 'channel')
 * @param entityId - The ID of the entity
 * @param hasAccessControl - Whether the entity has access control enabled
 * @returns An object containing the attribute tags, loading state, and fetch function
 */
export const useAccessControlAttributes = (
    entityType: EntityType,
    entityId: string | undefined,
    hasAccessControl: boolean | undefined,
) => {
    const [attributeTags, setAttributeTags] = useState<string[]>([]);
    const [structuredAttributes, setStructuredAttributes] = useState<AccessControlAttribute[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const dispatch = useDispatch();

    const applyProcessed = useCallback((processed: ProcessedAttributes) => {
        setAttributeTags(processed.attributeTags);
        setStructuredAttributes(processed.structuredAttributes);
    }, []);

    const fetchAttributes = useCallback(async (forceRefresh = false) => {
        if (!entityId || !hasAccessControl) {
            return;
        }

        setLoading(true);
        setError(null);

        try {
            if (!SUPPORTED_ENTITY_TYPES.includes(entityType)) {
                throw new Error(`Unsupported entity type: ${entityType}`);
            }

            const cacheKey = `${entityType}:${entityId}`;
            const cachedEntry = attributesCache[cacheKey];
            const now = Date.now();

            // Serve from cache when fresh and the caller didn't force a refresh.
            if (!forceRefresh && cachedEntry && (now - cachedEntry.timestamp < CACHE_TTL)) {
                applyProcessed(cachedEntry.processedData);
                setLoading(false);
                return;
            }

            let result;
            switch (entityType) {
            case EntityType.Channel:
                result = await dispatch(getChannelAccessControlAttributes(entityId));
                break;
            default:
                // defensive programming: if we add new entity types, we should handle them here
                throw new Error(`Unsupported entity type: ${entityType}`);
            }

            if (result.error) {
                throw result.error;
            }

            const processed = processAttributeData(result.data);
            attributesCache[cacheKey] = {processedData: processed, timestamp: now};
            applyProcessed(processed);
        } catch (err) {
            setError(err as Error);
            applyProcessed(EMPTY_PROCESSED);
        } finally {
            setLoading(false);
        }
    }, [entityType, entityId, hasAccessControl, dispatch, applyProcessed]);

    useEffect(() => {
        fetchAttributes();
    }, [fetchAttributes]);

    return {
        attributeTags,
        structuredAttributes,
        loading,
        error,
        fetchAttributes,
    };
};

export default useAccessControlAttributes;
