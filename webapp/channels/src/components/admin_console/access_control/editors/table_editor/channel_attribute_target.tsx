// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import type {IntlShape} from 'react-intl';

import {CheckIcon, CodeBracketsIcon} from '@mattermost/compass-icons/components';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import * as Menu from 'components/menu';

import {getUserPropertyFieldLabel} from 'utils/properties';

import {AttributeIcon} from './attribute_selector_menu';

// Renders the CHANNEL ATTRIBUTES section of the consolidated right-hand-side
// dropdown: the comparable channel fields the row's user attribute may be
// compared against, as a single-select radio list with a checkmark on the
// current target. Selecting one switches the row from a literal value to a
// resource.attributes.<name> target (the caller clears the literal values).
//
// Returned as a flat array (not a wrapper component) so the items stay direct
// children of the MUI menu list — matching the option-list render — which keeps
// keyboard navigation working.
export function channelAttributeMenuItems(
    channelFields: UserPropertyField[],
    selectedName: string | undefined,
    onSelect: (name: string) => void,
    formatMessage: IntlShape['formatMessage'],
): React.ReactNode[] {
    if (channelFields.length === 0) {
        return [];
    }

    const items: React.ReactNode[] = [
        <Menu.Separator key='channel-attr-separator'/>,
        <Menu.Title
            key='channel-attr-title'
            role='presentation'
        >
            {formatMessage({
                id: 'admin.access_control.table_editor.rhs.channel_attributes_section',
                defaultMessage: 'Channel attributes',
            })}
        </Menu.Title>,
    ];

    for (const field of channelFields) {
        const isSelected = field.name === selectedName;
        items.push(
            <Menu.Item
                id={`channel-attr-${field.id}`}
                key={`channel-attr-${field.id}`}
                role='menuitemradio'
                forceCloseOnSelect={true}
                aria-checked={isSelected}
                onClick={() => onSelect(field.name)}
                leadingElement={
                    <AttributeIcon
                        attribute={field}
                        size={18}
                    />
                }
                labels={<span>{getUserPropertyFieldLabel(field)}</span>}
                trailingElements={isSelected && <CheckIcon/>}
            />,
        );
    }

    return items;
}

// The button label shown when the row compares against a channel attribute
// (target mode): a monospace "[] Channel: X" chip. The bracket glyph marks it
// as a channel-attribute reference (as opposed to a literal value). Rendered as
// the first child of the button's inner wrapper, next to the chevron.
export function SelectedChannelAttributeLabel({field, fallbackName}: {field?: UserPropertyField; fallbackName: string}): JSX.Element {
    return (
        <span className='value-selector-menu-button__target-label'>
            <CodeBracketsIcon size={12}/>
            <FormattedMessage
                id='admin.access_control.table_editor.rhs.channel_target_label'
                defaultMessage='Channel: {name}'
                values={{name: field ? getUserPropertyFieldLabel(field) : fallbackName}}
            />
        </span>
    );
}
