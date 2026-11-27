// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {KeyboardEvent, MouseEvent} from 'react';
import {useCallback, useMemo, useRef, useState} from 'react';
import {useIntl} from 'react-intl';

import type {PropertyFieldOption} from '@mattermost/types/properties';

import Constants from 'utils/constants';

import {useOptionRemovalGuard} from './use_option_removal_guard';
import type {OptionUsageCheck} from './use_option_removal_guard';

type Args = {
    orderedOptions: PropertyFieldOption[];
    onOptionsChange: (options: PropertyFieldOption[]) => void;
    buildNewOption: (name: string) => PropertyFieldOption;

    // Set when removing a saved option must first check that channels do not use it.
    usageCheck?: OptionUsageCheck;
};

// Shared add/remove/rename/duplicate-detection logic for both options chip
// editors (attribute_options_values.tsx for Select/Multiselect,
// attribute_options_rank_values.tsx for Rank) -- the two editors differ only
// in how they order options and how a new option is constructed (Rank assigns
// a rank; Select/Multiselect doesn't), which is why `orderedOptions` and
// `buildNewOption` are the two things callers supply. Reorder logic
// (moveOptionByIndex vs. rank_utils.ts's moveOptionByAscIndex) stays in each
// component, since a plain-index move and a rank-value move are genuinely
// different operations, not a shared concern.
export function useOptionChipEditor({orderedOptions, onOptionsChange, buildNewOption, usageCheck}: Args) {
    const {formatMessage} = useIntl();
    const [query, setQuery] = useState('');
    const addInputRef = useRef<HTMLInputElement>(null);

    const trimmedQuery = query.trim();
    const isDuplicate = useMemo(
        () => Boolean(trimmedQuery) && orderedOptions.some((option) => option.name === trimmedQuery),
        [orderedOptions, trimmedQuery],
    );

    // Whether `name` already belongs to an option other than the one at
    // exceptIndex (an index into `orderedOptions`).
    const nameCollidesWith = useCallback(
        (name: string, exceptIndex: number) =>
            orderedOptions.some((option, i) => i !== exceptIndex && option.name === name),
        [orderedOptions],
    );

    const handleRename = useCallback((index: number, name: string) => {
        const trimmed = name.trim();
        if (!trimmed || orderedOptions[index]?.name === trimmed) {
            return;
        }
        if (nameCollidesWith(trimmed, index)) {
            return;
        }
        onOptionsChange(orderedOptions.map((option, i) => (i === index ? {...option, name: trimmed} : option)));
    }, [orderedOptions, nameCollidesWith, onOptionsChange]);

    const removalGuard = useOptionRemovalGuard(usageCheck);

    // The usage check is asynchronous, so the removal itself reads the latest
    // list rather than the one from the render that started it.
    const latestRef = useRef({orderedOptions, onOptionsChange});
    latestRef.current = {orderedOptions, onOptionsChange};

    const handleRemove = useCallback((index: number) => {
        const target = orderedOptions[index];
        if (!target) {
            return;
        }
        removalGuard.requestRemoval(target.id, () => {
            const latest = latestRef.current;
            latest.onOptionsChange(latest.orderedOptions.filter((option) => (target.id ? option.id !== target.id : option !== target)));
        });
    }, [orderedOptions, removalGuard]);

    const addValue = useCallback(() => {
        if (!trimmedQuery || isDuplicate) {
            return;
        }
        onOptionsChange([...orderedOptions, buildNewOption(trimmedQuery)]);
        setQuery('');
    }, [trimmedQuery, isDuplicate, orderedOptions, onOptionsChange, buildNewOption]);

    const handleQueryKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            addValue();
        } else if (event.key === 'Tab' && trimmedQuery && !isDuplicate) {
            event.preventDefault();
            addValue();
        }
    }, [addValue, trimmedQuery, isDuplicate]);

    const placeholderText = formatMessage({
        id: 'admin.global_attributes.attribute_details.options.add_placeholder',
        defaultMessage: 'Add values… (required)',
    });

    const showPlaceholder = orderedOptions.length === 0;

    const focusInput = useCallback((event: MouseEvent<HTMLDivElement>) => {
        if (event.target === event.currentTarget) {
            event.preventDefault();
            addInputRef.current?.focus();
        }
    }, []);

    return {
        query,
        setQuery,
        addInputRef,
        isDuplicate,
        nameCollidesWith,
        handleRename,
        handleRemove,
        removalGuard,
        addValue,
        handleQueryKeyDown,
        placeholderText,
        showPlaceholder,
        focusInput,
        maxOptionNameLength: Constants.MAX_CUSTOM_ATTRIBUTE_LENGTH,
    };
}
