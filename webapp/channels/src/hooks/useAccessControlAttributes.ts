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

// Module-level cache for access control attributes
// The cache stores processed data with a timestamp to implement a TTL (time-to-live)
const attributesCache: Record<string, {
    processedData: {
        attributeTags: string[];
        structuredAttributes: AccessControlAttribute[];
    };
    timestamp: number;
}> = {};

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

// Array of supported entity types for validation
const SUPPORTED_ENTITY_TYPES = Object.values(EntityType);

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

    // Helper function to process attribute data and extract tags
    const processAttributeData = useCallback((data: Record<string, string[]> | undefined) => {
        if (!data) {
            setAttributeTags([]);
            setStructuredAttributes([]);
            return;
        }

        const tags: string[] = [];
        const attributes: AccessControlAttribute[] = [];

        // Extract values from all properties in the response
        // Format: { "attributeName": ["value1", "value2"], "anotherAttribute": ["value3"] }
        Object.entries(data).forEach(([name, values]) => {
            // Add to structured format
            if (Array.isArray(values)) {
                attributes.push({name, values: [...values]});

                // Add to flat tags (existing behavior)
                values.forEach((value) => {
                    if (value !== undefined && value !== null) {
                        tags.push(value);
                    }
                });
            }
        });

        setAttributeTags(tags);
        setStructuredAttributes(attributes);
    }, []);

    const fetchAttributes = useCallback(async (forceRefresh = false) => {
        if (!entityId || !hasAccessControl) {
            return;
        }

        // Set loading state at the beginning
        setLoading(true);
        setError(null);

        try {
            // Validate entity type first
            if (!SUPPORTED_ENTITY_TYPES.includes(entityType)) {
                throw new Error(`Unsupported entity type: ${entityType}`);
            }

            // Check cache first (unless forceRefresh is true)
            const cacheKey = `${entityType}:${entityId}`;
            const cachedEntry = attributesCache[cacheKey];
            const now = Date.now();

            // Use cache if it exists and is not too old and forceRefresh is false
            // But still set loading to false to trigger a state update for tests
            if (!forceRefresh && cachedEntry && (now - cachedEntry.timestamp < CACHE_TTL)) {
                // Use the cached processed data directly instead of reprocessing
                setAttributeTags(cachedEntry.processedData.attributeTags);
                setStructuredAttributes(cachedEntry.processedData.structuredAttributes);
                setLoading(false);
                return;
            }

            // Handle different entity types
            let result;
            switch (entityType) {
            case EntityType.Channel:
                result = await dispatch(getChannelAccessControlAttributes(entityId));
                break;
            default:
                // defensive programming: if we add new entity types, we should handle them here
                throw new Error(`Unsupported entity type: ${entityType}`);
            }

            // Check for error in the result
            if (result.error) {
                throw result.error;
            }
            const data = result.data;

            // Process the data and store it in cache
            if (data) {
                const processedTags: string[] = [];
                const processedAttributes: AccessControlAttribute[] = [];

                // Process the data once
                Object.entries(data).forEach(([name, values]) => {
                    if (Array.isArray(values)) {
                        processedAttributes.push({name, values: [...values]});
                        values.forEach((value) => {
                            if (value !== undefined && value !== null) {
                                processedTags.push(value);
                            }
                        });
                    }
                });

                // Store only the processed data
                attributesCache[cacheKey] = {
                    processedData: {
                        attributeTags: processedTags,
                        structuredAttributes: processedAttributes,
                    },
                    timestamp: now,
                };

                // Set state
                setAttributeTags(processedTags);
                setStructuredAttributes(processedAttributes);
            } else {
                // Handle the case where data is undefined or null
                setAttributeTags([]);
                setStructuredAttributes([]);
            }
        } catch (err) {
            setError(err as Error);
            setAttributeTags([]);
            setStructuredAttributes([]);
        } finally {
            setLoading(false);
        }
    }, [entityType, entityId, hasAccessControl, processAttributeData]);

    // Fetch attributes when the component mounts or when dependencies change
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
