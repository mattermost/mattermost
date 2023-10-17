// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ValueType} from 'react-select';
import ReactSelect from 'react-select';

import type {SectionItemProps} from './section_item_creator';
import SectionItemCreator from './section_item_creator';

export type Limit = {
    value: number;
    label: string;
};

export type FieldsetReactSelect = {
    dataTestId?: string;
    options: Limit[];
}

type Props = SectionItemProps & {
    inputFieldData: FieldsetReactSelect;
    inputFieldValue: Limit;
    handleChange: (selected: ValueType<Limit>) => void;
}
function ReactSelectItemCreator({
    title,
    description,
    inputFieldData,
    inputFieldValue,
    handleChange,
}: Props): JSX.Element {
    const content = (
        <fieldset className='mm-modal-generic-section-item__fieldset-react-select'>
            <ReactSelect
                className='react-select'
                classNamePrefix='react-select'
                id='limitVisibleGMsDMs'
                options={inputFieldData.options}
                clearable={false}
                onChange={handleChange}
                value={inputFieldValue}
                isSearchable={false}
                menuPortalTarget={document.body}
                styles={reactStyles}
            />
        </fieldset>
    );
    return (
        <SectionItemCreator
            content={content}
            title={title}
            description={description}
        />
    );
}

export default ReactSelectItemCreator;

const reactStyles = {
    menuPortal: (provided: React.CSSProperties) => ({
        ...provided,
        zIndex: 9999,
    }),
};
