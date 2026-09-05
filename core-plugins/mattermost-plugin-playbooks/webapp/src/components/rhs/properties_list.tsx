// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';

import {PropertyField, PropertyValue} from 'src/types/properties';
import {useAllowPlaybookAttributes} from 'src/hooks/license';

import RHSProperty from 'src/components/rhs/rhs_property';

interface Props {
    propertyFields?: PropertyField[];
    propertyValues?: PropertyValue[];
    runID: string;
    className?: string;
}

const PropertiesList = (props: Props) => {
    const allowPlaybookAttributes = useAllowPlaybookAttributes();

    // Match property fields with their values using useMemo for performance
    const propertiesWithValues = useMemo(() => {
        if (!props.propertyFields) {
            return [];
        }

        return props.propertyFields.map((field) => {
            const matchingValue = props.propertyValues?.find(
                (value) => value.field_id === field.id
            );
            return {
                field,
                value: matchingValue,
            };
        });
    }, [props.propertyFields, props.propertyValues]);

    if (!allowPlaybookAttributes || propertiesWithValues.length === 0) {
        return null;
    }

    return (
        <div className={props.className}>
            {propertiesWithValues.map(({field, value}) => (
                <RHSProperty
                    key={field.id}
                    field={field}
                    value={value}
                    runID={props.runID}
                />
            ))}
        </div>
    );
};

export default PropertiesList;