// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ReactNode} from 'react';

import Tag from 'components/widgets/tag/tag';

type RadioGroupProps = {
    id: string;
    values: Array<{ key: React.ReactNode | React.ReactNodeArray; value: string; testId?: string}>;
    value: string;
    badge?: {matchVal: string; badgeContent: ReactNode; extraClass?: string} | undefined | null;
    sideLegend?: {matchVal: string; text: ReactNode};
    isDisabled?: null | ((id: string) => boolean);
    onChange(e: React.ChangeEvent<HTMLInputElement>): void;
    testId?: string;
}
const RadioButtonGroup = ({
    id,
    onChange,
    isDisabled,
    values,
    value,
    badge,
    sideLegend,
    testId,
}: RadioGroupProps) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e);
    };

    const options = [];
    for (const {value: val, key, testId} of values) {
        const disabled = isDisabled ? isDisabled(val) : false;
        const moreProps: {'data-testid'?: string} = {};
        if (testId) {
            moreProps['data-testid'] = testId;
        }
        options.push(
            <div
                className='radio'
                key={val}
            >
                <label className={val === value ? 'selected' : ''}>
                    <input
                        type='radio'
                        value={val}
                        name={id}
                        checked={val === value}
                        onChange={handleChange}
                        disabled={disabled}
                        {...moreProps}
                    />
                    {key}
                    {(sideLegend && val === sideLegend?.matchVal) &&
                        <span className='side-legend'>
                            {sideLegend.text}
                        </span>
                    }
                </label>
                {(badge && val === badge?.matchVal) &&
                    <Tag
                        className={`radio-badge ${badge.extraClass ?? ''}`}
                        text={badge.badgeContent}
                    />
                }
            </div>,
        );
    }

    return (
        <div
            className='radio-list'
            data-testid={testId || ''}
        >
            {options}
        </div>
    );
};

export default RadioButtonGroup;
