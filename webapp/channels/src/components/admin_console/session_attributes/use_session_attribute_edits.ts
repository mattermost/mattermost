// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useMemo, useState} from 'react';
import {useDispatch} from 'react-redux';

import {SESSION_ATTRIBUTES_GROUP_ID, SESSION_ATTRIBUTES_OBJECT_TYPE} from '@mattermost/types/properties_user';

import {patchPropertyField} from 'mattermost-redux/actions/properties';

import {getSessionAttrs} from './utils';
import type {SessionAttributeField} from './utils';

export type StagedAttrs = Partial<{
    enabled: boolean;
    ttl_seconds: number;
    grace_period_seconds: number;
}>;

type PendingMap = Record<string, StagedAttrs>;

export type SessionAttributeEdits = {
    merged: SessionAttributeField[];
    hasChanges: boolean;
    saving: boolean;
    serverError: string | null;
    stage: (fieldId: string, partial: StagedAttrs) => void;
    cancel: () => void;
    save: () => Promise<void>;
};

const TUNABLE_KEYS: Array<keyof StagedAttrs> = ['enabled', 'ttl_seconds', 'grace_period_seconds'];

export function useSessionAttributeEdits(serverFields: SessionAttributeField[]): SessionAttributeEdits {
    const dispatch = useDispatch();

    const [pending, setPending] = useState<PendingMap>({});
    const [saving, setSaving] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);

    const stage = useCallback((fieldId: string, partial: StagedAttrs) => {
        const serverField = serverFields.find((f) => f.id === fieldId);
        if (!serverField) {
            return;
        }
        const serverAttrs = getSessionAttrs(serverField);

        setPending((prev) => {
            const nextField: StagedAttrs = {...prev[fieldId], ...partial};

            for (const key of TUNABLE_KEYS) {
                if (key in nextField && nextField[key] === serverAttrs[key]) {
                    delete nextField[key];
                }
            }

            const next = {...prev};
            if (Object.keys(nextField).length === 0) {
                delete next[fieldId];
            } else {
                next[fieldId] = nextField;
            }
            return next;
        });
    }, [serverFields]);

    const cancel = useCallback(() => {
        setPending({});
        setServerError(null);
    }, []);

    const save = useCallback(async () => {
        const entries = Object.entries(pending);
        if (entries.length === 0) {
            return;
        }

        setSaving(true);
        setServerError(null);

        const results = await Promise.allSettled(entries.map(([id, attrs]) =>
            dispatch(patchPropertyField(SESSION_ATTRIBUTES_GROUP_ID, SESSION_ATTRIBUTES_OBJECT_TYPE, id, {attrs})),
        ));

        const saved: PendingMap = {};
        let failed = false;

        results.forEach((res, index) => {
            const [id, attrs] = entries[index];
            if (res.status === 'fulfilled' && !res.value?.error) {
                saved[id] = attrs;
            } else {
                failed = true;
            }
        });

        setPending((cur) => {
            const next = {...cur};

            for (const [id, savedAttrs] of Object.entries(saved)) {
                const current = next[id];
                if (!current) {
                    continue;
                }

                const remaining: StagedAttrs = {...current};
                for (const key of TUNABLE_KEYS) {
                    if (key in savedAttrs && remaining[key] === savedAttrs[key]) {
                        delete remaining[key];
                    }
                }

                if (Object.keys(remaining).length === 0) {
                    delete next[id];
                } else {
                    next[id] = remaining;
                }
            }

            return next;
        });
        setServerError(failed ? 'error' : null);
        setSaving(false);
    }, [pending, dispatch]);

    const merged = useMemo<SessionAttributeField[]>(() => serverFields.map((f) => {
        const p = pending[f.id];
        if (!p) {
            return f;
        }
        return {...f, attrs: {...f.attrs, ...p}};
    }), [serverFields, pending]);

    const hasChanges = Object.keys(pending).length > 0;

    return {merged, hasChanges, saving, serverError, stage, cancel, save};
}
