// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessages, useIntl} from 'react-intl';

import type {CheckParentEdgeInvalid} from './graph_utils';

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
        text = formatMessage(messages.cycleError, {parent: parentName, child: childName});
        break;
    case 'depth':
        text = formatMessage(messages.depthError, {name: childName, n: result.depth});
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
        defaultMessage: "{parent} can't be a parent of {child} — {child} already grants {parent}, so this would loop back on itself.",
    },
    depthError: {
        id: 'admin.global_attributes.attribute_details.options.graph.parent_edge.depth',
        defaultMessage: 'Adding this parent pushes "{name}" to depth {n}; the limit is 100.',
    },
    maxParentsError: {
        id: 'admin.global_attributes.attribute_details.options.graph.parent_edge.max_parents',
        defaultMessage: 'An option can have at most 100 parents.',
    },
});
