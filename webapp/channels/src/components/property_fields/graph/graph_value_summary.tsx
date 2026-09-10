// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {defineMessage, FormattedList, FormattedMessage, useIntl} from 'react-intl';

import useGetFeatureFlagValue from 'components/common/hooks/useGetFeatureFlagValue';

import type {GraphFieldRef} from './page_all_access_control_field_options';

import {useGraphOptionNames} from './use_graph_option_names';

export const unavailableValueMessage: MessageDescriptor = defineMessage({
    id: 'property_fields.hierarchical_value_menu.unavailable_value',
    defaultMessage: 'Value unavailable',
});

export type GraphValueSummaryProps = {
    field: GraphFieldRef;
    ids: readonly string[];
    mode: 'confirm' | 'describe';
};

export default function GraphValueSummary({field, ids, mode}: GraphValueSummaryProps): JSX.Element | string {
    const {formatMessage} = useIntl();
    const flagOn = useGetFeatureFlagValue('PropertyFieldGraph') === 'true';
    const {labelForId} = useGraphOptionNames(field, ids);

    if (ids.length === 0) {
        return '';
    }

    if (mode === 'confirm') {
        const separator = formatMessage({
            id: 'admin.userManagement.userDetail.arrayValueSeparator',
            defaultMessage: ', ',
        });
        return ids.map((id) => {
            const label = labelForId(id);
            if (label.kind === 'name') {
                return label.text;
            }
            if (label.kind === 'id' || !flagOn) {
                return id;
            }
            return formatMessage(unavailableValueMessage);
        }).join(separator);
    }

    const named = ids.map((id) => labelForId(id));
    if (named.every((label) => label.kind === 'name')) {
        return <FormattedList value={named.map((label) => label.text)}/>;
    }

    return (
        <FormattedMessage
            id='user.settings.general.graphValuesSelected'
            defaultMessage='{count, plural, one {# value selected} other {# values selected}}'
            values={{count: ids.length}}
        />
    );
}
