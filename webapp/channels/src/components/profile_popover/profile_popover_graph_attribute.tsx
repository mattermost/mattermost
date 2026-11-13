// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedList, FormattedMessage} from 'react-intl';

import type {UserPropertyField} from '@mattermost/types/properties_user';
import type {UserProfile} from '@mattermost/types/users';

import {asGraphValueIds} from 'components/property_fields/graph';
import {useGraphOptionNames} from 'components/property_fields/graph/use_graph_option_names';

type Props = {
    attribute: UserPropertyField;
    userProfile: UserProfile;
};

const ProfilePopoverGraphAttribute = ({attribute, userProfile}: Props) => {
    const storedIds = asGraphValueIds(userProfile.custom_profile_attributes?.[attribute.id]);
    const {labelForId} = useGraphOptionNames(attribute, storedIds, {walk: true});

    if (storedIds.length === 0) {
        return null;
    }

    const named = storedIds.map((id) => labelForId(id));
    const allNamed = named.every((label) => label.kind === 'name');

    return (
        <p
            aria-labelledby={`user-popover__custom_attributes-title-${attribute.id}`}
            className='user-popover__subtitle-text'
        >
            {allNamed ? (
                <FormattedList value={named.map((label) => label.text)}/>
            ) : (
                <FormattedMessage
                    id='user.settings.general.graphValuesSelected'
                    defaultMessage='{count, plural, one {# value selected} other {# values selected}}'
                    values={{count: storedIds.length}}
                />
            )}
        </p>
    );
};

export default ProfilePopoverGraphAttribute;
