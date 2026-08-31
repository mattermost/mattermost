// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import type {PropertyFieldOption} from '@mattermost/types/properties';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import useGetFeatureFlagValue from 'components/common/hooks/useGetFeatureFlagValue';
import {PolicyHierarchicalValues} from 'components/property_fields/hierarchical_value_menu';

import {channelAttributeMenuItems} from './channel_attribute_target';
import MaskedChip from './masked_chip';
import MultiValueSelector from './multi_value_selector_menu';
import SingleValueSelector from './single_value_selector_menu';

import {isMultiValueOperator} from '../shared';

export interface TableRow {
    attribute: string;

    // 'user' | 'session'; drives the CEL namespace. Defaults to user.
    attribute_object_type?: string;
    operator: string;
    values: string[];
    attribute_type: string;
    hasMaskedValues: boolean;

    // When set, the right-hand side of the condition is the accessed channel's
    // attribute (resource.attributes.<targetAttribute>) rather than a literal
    // value; `values` is then ignored. Only meaningful for comparison operators
    // and the multiselect list operators (has any of / has all of). The left
    // side stays the requesting user's attribute.
    targetAttribute?: string;

    // Native user attributes are referenced as `user.<name>` (vs `user.attributes.<name>`).
    isNative?: boolean;

    // Native boolean attributes (e.g. user.verified) emit unquoted true/false literals.
    isBoolean?: boolean;
}

export interface ValueSelectorMenuProps {
    row: TableRow;
    disabled: boolean;
    updateValues: (values: string[]) => void;
    options?: PropertyFieldOption[];
    allowCreateValue?: boolean;
    placeholder?: string;

    // Comparable channel attributes offered as the right-hand side alongside
    // literal values (the consolidated VALUES + CHANNEL ATTRIBUTES dropdown).
    // Empty/undefined when the operator or attribute type has no target. When
    // one is picked, the row switches to a resource.attributes.<name> target.
    channelFields?: UserPropertyField[];
    onSelectTarget?: (name: string) => void;

    // The resolved field behind the row, for the attribute types whose Values
    // control depends on more than the option list: a graph attribute draws its
    // options from a hierarchy, which needs the field's identity to page.
    // Undefined when the rule names an attribute that no longer exists.
    field?: UserPropertyField;

    // Only used to make the graph menu's element ids unique per row, since the
    // hierarchical widget derives its row ids from the menu id.
    rowIndex?: number;
}

const ValueSelectorMenu = ({
    row,
    disabled,
    updateValues,
    options = [],
    allowCreateValue = false,
    placeholder,
    channelFields = [],
    onSelectTarget,
    field,
    rowIndex = 0,
}: ValueSelectorMenuProps) => {
    const {formatMessage} = useIntl();
    const graphTreeEnabled = useGetFeatureFlagValue('PropertyFieldGraph') === 'true';
    const isGraph = field?.type === 'graph';
    const isMultiOperator = isMultiValueOperator(row.operator);

    // The hierarchy picker replaces the flat option list only for a graph
    // attribute holding literal option names. Target mode keeps the flat
    // control: its right-hand side is the channel's attribute, so there is no
    // option list to render and SelectedChannelAttributeLabel owns the button.
    // The operator test guards a row the server would refuse anyway (only the
    // four predicates and the two membership operators are legal on a graph
    // field, and all six are multi-value) rather than selecting a behaviour.
    const useHierarchy = graphTreeEnabled && isGraph && !row.targetAttribute && isMultiOperator;

    if (useHierarchy) {
        return (
            <PolicyHierarchicalValues
                field={{
                    id: field.id,
                    object_type: field.object_type,
                    type: field.type,

                    // attrs.options must reach the adapter as the same array
                    // instance across renders: the adapter joins the inlined
                    // name<->id map in a memo keyed on the array's identity, and
                    // that join feeds the chip labels and the checked state. A
                    // fresh object here is harmless, but normalising the array --
                    // `options: field.attrs?.options ?? []` -- allocates a new
                    // one every render and re-joins the whole hierarchy each
                    // time. Pass it through untouched.
                    attrs: field.attrs,
                }}
                names={row.values}
                onNamesChange={updateValues}
                disabled={disabled}

                // Both ids keep the prefixes the Playwright policy specs locate
                // by ([id^="value-selector-menu"], valueSelectorMenuButton) and
                // add the row index, which the flat control omits: the widget
                // builds its row ids off menuId, so two rows must not share one.
                menuId={`value-selector-menu-${rowIndex}`}
                buttonId={`value-selector-button-${rowIndex}`}
                buttonDataTestId='valueSelectorMenuButton'
                placeholder={placeholder}
                className='values-editor'

                // Conditional: the widget shows its placeholder only when there
                // are no chips AND no trailing chips, so an unconditional chip
                // would hide "Select values..." on every empty graph row.
                trailingChips={row.hasMaskedValues ? <MaskedChip/> : undefined}

                // The CHANNEL ATTRIBUTES block, appended below the value rows.
                // Already a flat array, which is what extraMenuItems requires.
                extraMenuItems={onSelectTarget ? channelAttributeMenuItems(channelFields, row.targetAttribute, onSelectTarget, formatMessage) : undefined}
            />
        );
    }

    if (isMultiOperator) {
        return (
            <MultiValueSelector
                values={row.values}
                disabled={disabled}
                updateValues={updateValues}
                options={options}
                allowCreateValue={allowCreateValue}
                placeholder={placeholder}
                hasMaskedValues={row.hasMaskedValues}
                channelFields={channelFields}
                targetAttribute={row.targetAttribute}
                onSelectTarget={onSelectTarget}
                forbidCreate={isGraph}
            />
        );
    }

    return (
        <SingleValueSelector
            value={row.values[0] || ''}
            disabled={disabled}
            updateValue={(value) => updateValues([value])}
            options={options}
            allowCreateValue={allowCreateValue}
            placeholder={placeholder}
            hasMaskedValues={row.hasMaskedValues}
            channelFields={channelFields}
            targetAttribute={row.targetAttribute}
            onSelectTarget={onSelectTarget}
        />
    );
};

export default ValueSelectorMenu;
