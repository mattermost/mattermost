// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {Client4} from 'mattermost-redux/client';

import {GLOBAL_ATTRIBUTES_GROUP_NAME} from '../constants';

// The saved field whose options channels may hold. Undefined where nothing
// applies the field to channels, so removing an option needs no check.
export type OptionUsageCheck = {
    objectType: string;
    fieldId: string;
};

export type OptionRemovalGuard = {
    isChecking: (optionId: string) => boolean;
    isInUse: (optionId: string) => boolean;
    hasCheckFailed: (optionId: string) => boolean;

    // Runs remove straight away for an option that was never saved. For a saved
    // one it first asks the server whether channels use it, and removes it only
    // when they do not.
    requestRemoval: (optionId: string, remove: () => void) => void;
};

// Options added in the editor have no id yet, or a client-made placeholder.
function isSavedOptionId(optionId: string): boolean {
    return optionId !== '' && !optionId.startsWith('pending_');
}

function toggled(set: ReadonlySet<string>, optionId: string, present: boolean): ReadonlySet<string> {
    if (set.has(optionId) === present) {
        return set;
    }
    const next = new Set(set);
    if (present) {
        next.add(optionId);
    } else {
        next.delete(optionId);
    }
    return next;
}

export function useOptionRemovalGuard(check: OptionUsageCheck | undefined): OptionRemovalGuard {
    const [checking, setChecking] = useState<ReadonlySet<string>>(new Set());
    const [inUse, setInUse] = useState<ReadonlySet<string>>(new Set());
    const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());

    const mountedRef = useRef(true);
    useEffect(() => () => {
        mountedRef.current = false;
    }, []);

    // Callers pass a fresh object each render; keying on its parts keeps the
    // guard stable so memoized consumers don't rebuild on every render.
    const objectType = check?.objectType;
    const fieldId = check?.fieldId;

    const requestRemoval = useCallback(async (optionId: string, remove: () => void) => {
        if (!objectType || !fieldId || !isSavedOptionId(optionId)) {
            remove();
            return;
        }

        setChecking((prev) => toggled(prev, optionId, true));
        setInUse((prev) => toggled(prev, optionId, false));
        setFailed((prev) => toggled(prev, optionId, false));

        let optionInUse = false;
        let checkFailed = false;
        try {
            const result = await Client4.getPropertyFieldOptionsInUse(GLOBAL_ATTRIBUTES_GROUP_NAME, objectType, fieldId, [optionId]);
            optionInUse = result.option_ids.includes(optionId);
        } catch {
            checkFailed = true;
        }

        if (!mountedRef.current) {
            return;
        }
        setChecking((prev) => toggled(prev, optionId, false));
        if (checkFailed) {
            setFailed((prev) => toggled(prev, optionId, true));
        } else if (optionInUse) {
            setInUse((prev) => toggled(prev, optionId, true));
        } else {
            remove();
        }
    }, [objectType, fieldId]);

    return useMemo(() => ({
        isChecking: (optionId: string) => checking.has(optionId),
        isInUse: (optionId: string) => inUse.has(optionId),
        hasCheckFailed: (optionId: string) => failed.has(optionId),
        requestRemoval,
    }), [checking, inUse, failed, requestRemoval]);
}
