// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useState} from 'react';

import type {PropertyField} from '@mattermost/types/properties';

import {listPropertyFields} from '../../utils';

export type ChannelFieldState = {

    // The saved field, or null until it loads (or when it cannot be found).
    field: PropertyField | null;
    setField: (field: PropertyField) => void;
};

// useChannelField loads the saved channel field behind the Required toggle, so
// the section can tell whether channel creators are able to set its value.
// enabled=false and an undefined fieldId (create mode) never fetch. A change to
// revision refetches, for a host that saves the field without leaving the page.
export default function useChannelField(args: {fieldId?: string; enabled: boolean; revision?: number}): ChannelFieldState {
    const {fieldId, enabled, revision} = args;

    // Compared with fieldId on the way out, so a switch to another field never
    // reads as the previous field's state.
    const [state, setState] = useState<PropertyField | null>(null);

    useEffect(() => {
        if (!enabled || !fieldId) {
            return undefined;
        }

        let cancelled = false;
        listPropertyFields('channel').then((fields) => {
            if (!cancelled) {
                setState(fields.find((candidate) => candidate.id === fieldId) ?? null);
            }
        }).catch(() => {
            // Without the field there is nothing to warn about; the server still
            // refuses an unfillable Required on save.
        });

        return () => {
            cancelled = true;
        };
    }, [enabled, fieldId, revision]);

    return {
        field: enabled && fieldId && state?.id === fieldId ? state : null,
        setField: setState,
    };
}
