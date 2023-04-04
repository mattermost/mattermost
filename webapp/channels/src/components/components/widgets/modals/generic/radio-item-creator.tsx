// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import SectionItemCreator, {SectionItemProps} from './section_item_creator';

export type FieldsetRadio = {
    options: Array<{
        dataTestId?: string;
        title: {
            id: string;
            defaultMessage: string;
        };
        name: string;
        key: string;
        value: string;
        suffix?: JSX.Element;
    }>;
}

type Props = SectionItemProps & {
    inputFieldData: FieldsetRadio;
    inputFieldValue: string;
    handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}
function RadioItemCreator({
    title,
    description,
    inputFieldData,
    inputFieldValue,
    handleChange,
}: Props): JSX.Element {
    const fields = inputFieldData.options.map((option) => {
        return (
            <label
                key={option.key}
                className='mm-modal-generic-section-item__label-radio'
            >
                <input
                    id={option.key}
                    data-testid={option.dataTestId}
                    type='radio'
                    name={option.name}
                    checked={option.value === inputFieldValue}
                    value={option.value}
                    onChange={handleChange}
                />
                <FormattedMessage
                    id={option.title.id}
                    defaultMessage={option.title.defaultMessage}
                />
                {option.suffix}
            </label>
        );
    });

    const content = (
        <>
            <fieldset className='mm-modal-generic-section-item__fieldset-radio'>
                {[...fields]}
            </fieldset>
        </>
    );
    return (
        <SectionItemCreator
            content={content}
            title={title}
            description={description}
        />
    );
}

export default RadioItemCreator;
