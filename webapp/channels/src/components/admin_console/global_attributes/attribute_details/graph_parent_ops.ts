// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyFieldOption} from '@mattermost/types/properties';

import type {GrantConfirmRequest} from './attribute_graph_grant_confirm_modal';
import {
    addParentEdge,
    checkParentEdge,
    replaceOccurrenceParent,
    type CheckParentEdgeResult,
} from './graph_utils';

export type ConfirmGrant = (req: GrantConfirmRequest) => Promise<boolean>;

export type ProposeParentResult =
    | {status: 'applied'; options: PropertyFieldOption[]}
    | {status: 'noOp'}
    | {status: 'cancelled'}
    | {status: 'fail-closed'}
    | {status: 'invalid'; check: Extract<CheckParentEdgeResult, {ok: false}>};

function toGrantReq(
    childName: string,
    parentName: string,
    check: Extract<CheckParentEdgeResult, {ok: true; noOp?: false}>,
): GrantConfirmRequest {
    return {
        parentName,
        childName,
        newlyReachable: check.newlyReachable,
        ancestorsOfParent: check.ancestorsOfParent,
    };
}

async function maybeConfirmAndApply(
    childName: string,
    parentName: string,
    check: CheckParentEdgeResult,
    confirmGrant: ConfirmGrant | undefined,
    apply: () => PropertyFieldOption[],
): Promise<ProposeParentResult> {
    if (!check.ok) {
        return {status: 'invalid', check};
    }
    if (check.noOp) {
        return {status: 'noOp'};
    }
    if (check.newlyReachable.length > 0) {
        if (!confirmGrant) {
            return {status: 'fail-closed'};
        }
        const confirmed = await confirmGrant(toGrantReq(childName, parentName, check));
        if (!confirmed) {
            return {status: 'cancelled'};
        }
    }
    return {status: 'applied', options: apply()};
}

export async function proposeAddParent(
    options: PropertyFieldOption[],
    childName: string,
    parentName: string,
    confirmGrant?: ConfirmGrant,
): Promise<ProposeParentResult> {
    const check = checkParentEdge(options, childName, parentName);
    return maybeConfirmAndApply(
        childName,
        parentName,
        check,
        confirmGrant,
        () => addParentEdge(options, childName, parentName),
    );
}

export async function proposeReplaceOccurrenceParent(
    options: PropertyFieldOption[],
    childName: string,
    oldParentName: string | null,
    newParentName: string,
    confirmGrant?: ConfirmGrant,
): Promise<ProposeParentResult> {
    const check = checkParentEdge(options, childName, newParentName, {
        removeParent: oldParentName,
    });
    return maybeConfirmAndApply(
        childName,
        newParentName,
        check,
        confirmGrant,
        () => replaceOccurrenceParent(options, childName, oldParentName, newParentName),
    );
}
