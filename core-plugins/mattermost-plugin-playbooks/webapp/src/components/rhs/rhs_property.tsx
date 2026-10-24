// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import {PropertyField, PropertyValue} from 'src/types/properties';

import {useSetRunPropertyValue} from 'src/graphql/hooks';

import TextProperty from './properties/property_text';
import SelectProperty from './properties/property_select';
import MultiselectProperty from './properties/property_multiselect';

interface Props {
    field: PropertyField;
    value?: PropertyValue;
    runID: string;
}

const RHSProperty = (props: Props) => {
    const [setRunPropertyValue] = useSetRunPropertyValue();

    const handleValueChange = (newValue: string | string[] | null) => {
        setRunPropertyValue(props.runID, props.field.id, newValue);
    };

    const renderPropertyComponent = () => {
        const commonProps = {
            field: props.field,
            value: props.value,
            runID: props.runID,
        };

        switch (props.field.type) {
        case 'text':
            return (
                <TextProperty
                    {...commonProps}
                    onValueChange={handleValueChange}
                />
            );
        case 'select':
            return (
                <SelectProperty
                    {...commonProps}
                    onValueChange={handleValueChange}
                />
            );
        case 'multiselect':
            return (
                <MultiselectProperty
                    {...commonProps}
                    onValueChange={handleValueChange}
                />
            );
        default:
            return null;
        }
    };

    return (
        <PropertyRow data-testid={`run-property-${props.field.name.toLowerCase().replace(/\s+/g, '-')}`}>
            <PropertyLabel>{props.field.name}</PropertyLabel>
            {renderPropertyComponent()}
        </PropertyRow>
    );
};

const PropertyRow = styled.div`
    display: flex;
    flex-flow: row nowrap;
    align-items: center;
    padding: 0 8px;
    margin-bottom: 12px;
`;

const PropertyLabel = styled.div`
    color: var(--center-channel-color);
    font-size: 12px;
    font-weight: 600;
    line-height: 24px;
    min-width: 120px;
    margin-right: 12px;
`;

export default RHSProperty;
