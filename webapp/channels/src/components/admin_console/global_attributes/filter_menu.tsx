// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage, useIntl} from 'react-intl';

import * as Menu from 'components/menu';
import Input from 'components/widgets/inputs/input/input';

// An undefined value is "All", which sends no filter.
export type FilterMenuOption<T extends string> = {
    value: T | undefined;
    label: MessageDescriptor;
};

type Props<T extends string> = {

    // Prefixes the element ids and names the input; must be unique on the page.
    id: string;
    testId: string;
    label: MessageDescriptor;
    menuButtonAriaLabel: MessageDescriptor;
    menuAriaLabel: MessageDescriptor;
    options: Array<FilterMenuOption<T>>;
    value: T | undefined;
    onChange: (value: T | undefined) => void;
};

// A single-select filter shown as a labelled read-only input that opens a menu
// of radio items.
export default function FilterMenu<T extends string>({id, testId, label, menuButtonAriaLabel, menuAriaLabel, options, value, onChange}: Props<T>) {
    const {formatMessage} = useIntl();
    const selected = options.find((option) => option.value === value) ?? options[0];

    return (
        <div className='GlobalAttributes__filter'>
            <Menu.Container
                menuButton={{
                    id: `${id}Button`,
                    class: 'inputWithMenu',
                    dataTestId: testId,
                    'aria-label': formatMessage(menuButtonAriaLabel),
                    as: 'div',
                    children: (
                        <Input
                            label={formatMessage(label)}
                            name={id}
                            value={formatMessage(selected.label)}
                            readOnly={true}
                            tabIndex={-1}
                            inputSuffix={<i className='icon icon-chevron-down'/>}
                        />
                    ),
                }}
                menu={{
                    id: `${id}Menu`,
                    'aria-label': formatMessage(menuAriaLabel),
                }}
            >
                {options.map((option) => {
                    const checked = option.value === selected.value;
                    const key = option.value ?? 'all';
                    return (
                        <Menu.Item
                            key={key}
                            id={`${id}-${key}`}
                            role='menuitemradio'
                            aria-checked={checked}
                            forceCloseOnSelect={true}
                            labels={<FormattedMessage {...option.label}/>}
                            trailingElements={checked && <i className='icon icon-check'/>}
                            onClick={() => onChange(option.value)}
                        />
                    );
                })}
            </Menu.Container>
        </div>
    );
}
