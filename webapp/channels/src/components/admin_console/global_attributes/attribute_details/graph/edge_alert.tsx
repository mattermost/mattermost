// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessages, useIntl} from 'react-intl';

import type {CheckParentEdgeInvalid} from './graph_utils';

const GRAPH_CYCLE_ERROR_DEFAULT =
    "{parent} can't be a parent of {child} — {child} already grants {parent}, so this would loop back on itself.";
const GRAPH_DEPTH_ERROR_DEFAULT =
    'Adding this parent pushes "{name}" to depth {n}; the limit is 100.';
const GRAPH_MAX_PARENTS_ERROR_DEFAULT =
    'An option can have at most 100 parents.';

function cycleErrorValues(parentName: string, childName: string): {parent: string; child: string} {
    return {parent: parentName, child: childName};
}

function depthErrorValues(name: string, depth: number): {name: string; n: number} {
    return {name, n: depth};
}

type Props = {
    result: CheckParentEdgeInvalid;
    childName: string;
    parentName: string;
    className: string;
    testId: string;
};

export function GraphParentEdgeAlert({result, childName, parentName, className, testId}: Props) {
    const {formatMessage} = useIntl();
    let text = '';
    switch (result.error) {
    case 'cycle':
        text = formatMessage(messages.cycleError, cycleErrorValues(parentName, childName));
        break;
    case 'depth':
        text = formatMessage(messages.depthError, depthErrorValues(childName, result.depth));
        break;
    case 'max-parents':
        text = formatMessage(messages.maxParentsError);
        break;
    case 'self':
        return null;
    default: {
        const exhaustive: never = result;
        return exhaustive;
    }
    }
    return (
        <div
            className={className}
            role='alert'
            data-testid={testId}
        >
            {text}
        </div>
    );
}

const messages = defineMessages({
    cycleError: {
        id: 'admin.global_attributes.attribute_details.options.graph.parent_edge.cycle',
        defaultMessage: GRAPH_CYCLE_ERROR_DEFAULT,
    },
    depthError: {
        id: 'admin.global_attributes.attribute_details.options.graph.parent_edge.depth',
        defaultMessage: GRAPH_DEPTH_ERROR_DEFAULT,
    },
    maxParentsError: {
        id: 'admin.global_attributes.attribute_details.options.graph.parent_edge.max_parents',
        defaultMessage: GRAPH_MAX_PARENTS_ERROR_DEFAULT,
    },
});
