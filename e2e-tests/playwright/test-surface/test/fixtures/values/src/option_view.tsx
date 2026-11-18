import React from 'react';

type Item = {id: string; name: string};
type ItemOption = {label: string; details: Item};

// one view renders a list option and the selected value: the flag picks the testid
export const OptionView = (props: ItemOption & {className: string; isSingleValue?: boolean}) => {
    const {details} = props;
    return (
        <div
            className={props.className}
            data-testid={props.isSingleValue ? 'values.picker.selected' : `values.picker.option:${details.id}`}
        />
    );
};

export const Option = (props: {data: ItemOption}) => {
    const {data} = props;
    return (
        <OptionView
            {...data}
            className='option'
        />
    );
};

export const SingleValue = (props: {data: ItemOption}) => {
    const {data} = props;
    return (
        <OptionView
            {...data}
            isSingleValue={true}
            className='singleValue'
        />
    );
};
