// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MmBlocksFormValues} from './form';

/** Optional 4th arg is legacy attachment `cookie`; 5th is typed mm_blocks form field values for submit/onChange. */
export type ActionHandler = (
    actionId: string,
    selectedOption?: string,
    query?: Record<string, string>,
    attachmentCookie?: string,
    formValues?: MmBlocksFormValues,
) => Promise<void>;

/** Dynamic select option lookup (dialog lookup API or doBlockAction subtype lookup). */
export type LookupHandler = (
    actionId: string,
    query: string,
    formValues?: MmBlocksFormValues,
) => Promise<Array<{text: string; value: string}>>;
