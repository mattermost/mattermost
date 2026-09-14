// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';

import {PlusIcon} from '@mattermost/compass-icons/components';
import {Button} from '@mattermost/shared/components/button';

import Input from 'components/widgets/inputs/input/input';

import Constants from 'utils/constants';

type AddTopLevelFormProps = {
    isEmptyCanvas: boolean;
    draftName: string;
    onDraftNameChange: (value: string) => void;
    isDuplicate: boolean;
    trimmed: string;
    atMax: boolean;
    canAdd: boolean;
    disabled: boolean;
    onCommit: () => void;
};

type ChildDraftRowProps = {
    depth: number;
    parentName: string;
    draftName: string;
    onDraftNameChange: (value: string) => void;
    isDuplicate: boolean;
    trimmed: string;
    canAdd: boolean;
    disabled: boolean;
    atMax: boolean;
    onCommit: () => void;
    onCancel: () => void;
};

export const AddTopLevelForm = ({
    isEmptyCanvas,
    draftName,
    onDraftNameChange,
    isDuplicate,
    trimmed,
    atMax,
    canAdd,
    disabled,
    onCommit,
}: AddTopLevelFormProps) => {
    const {formatMessage} = useIntl();
    const placeholder = formatMessage(isEmptyCanvas ? messages.namePlaceholder : messages.addTopLevel);
    const testIdPrefix = isEmptyCanvas ? 'attributeOptionsGraphEmpty' : 'attributeOptionsGraphAddTop';

    return (
        <div className={isEmptyCanvas ? 'attribute-options-graph-values__empty-form' : 'attribute-options-graph-values__add-top'}>
            <Input
                name={isEmptyCanvas ? 'graph_empty_option_name' : 'graph_add_top_option_name'}
                type='text'
                useLegend={false}
                label={placeholder}
                placeholder={placeholder}
                aria-label={formatMessage(messages.addTopLevel)}
                value={draftName}
                onChange={(e) => onDraftNameChange(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        if (canAdd) {
                            onCommit();
                        }
                    }
                }}
                disabled={disabled || atMax}
                maxLength={Constants.MAX_CUSTOM_ATTRIBUTE_LENGTH}
                hasError={isDuplicate}
                customMessage={isDuplicate ?
                    {type: 'error', value: formatMessage(messages.duplicateName, {name: trimmed})} :
                    null}
                data-testid={`${testIdPrefix}__nameInput`}
            />
            <Button
                type='button'
                emphasis={isEmptyCanvas ? 'primary' : 'secondary'}
                size={isEmptyCanvas ? 'sm' : 'md'}
                onClick={onCommit}
                disabled={!canAdd}
                data-testid={`${testIdPrefix}__addButton`}
            >
                <PlusIcon size={16}/>
                <FormattedMessage {...messages.addValue}/>
            </Button>
        </div>
    );
};

export function ChildDraftRow({
    depth,
    parentName,
    draftName,
    onDraftNameChange,
    isDuplicate,
    trimmed,
    canAdd,
    disabled,
    atMax,
    onCommit,
    onCancel,
}: ChildDraftRowProps) {
    const {formatMessage} = useIntl();
    const childNamePlaceholder = formatMessage(messages.childNamePlaceholder);

    return (
        <li
            className='attribute-options-graph-values__row attribute-options-graph-values__row--draft'
            style={{['--attribute-options-graph-values-indent' as string]: depth}}
            data-testid='attributeOptionsGraphRow__childDraft'
            data-depth={String(depth)}
        >
            <span
                className='attribute-options-graph-values__gutter'
                aria-hidden={true}
            >
                <span className='attribute-options-graph-values__collapse-spacer'/>
                <span className='attribute-options-graph-values__draft-handle-spacer'/>
            </span>
            <Input
                name='graph_child_option_name'
                type='text'
                useLegend={false}
                label={childNamePlaceholder}
                placeholder={childNamePlaceholder}
                aria-label={formatMessage(messages.childNameAria, {name: parentName})}
                value={draftName}
                onChange={(e) => onDraftNameChange(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        onCancel();
                        return;
                    }
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        if (canAdd) {
                            onCommit();
                        }
                    }
                }}
                disabled={disabled || atMax}
                maxLength={Constants.MAX_CUSTOM_ATTRIBUTE_LENGTH}
                hasError={isDuplicate}
                customMessage={isDuplicate ?
                    {type: 'error', value: formatMessage(messages.duplicateName, {name: trimmed})} :
                    null}
                data-testid='attributeOptionsGraphRow__childNameInput'
                autoFocus={true}
            />
            <Button
                type='button'
                emphasis='secondary'
                size='sm'
                onClick={onCommit}
                disabled={!canAdd}
                data-testid='attributeOptionsGraphRow__childAddButton'
            >
                <FormattedMessage {...messages.add}/>
            </Button>
            <Button
                type='button'
                emphasis='tertiary'
                size='sm'
                onClick={onCancel}
                data-testid='attributeOptionsGraphRow__childCancelButton'
            >
                <FormattedMessage {...messages.cancel}/>
            </Button>
        </li>
    );
}

const messages = defineMessages({
    namePlaceholder: {
        id: 'admin.global_attributes.attribute_details.options.graph.name_placeholder',
        defaultMessage: 'Value name',
    },
    childNamePlaceholder: {
        id: 'admin.global_attributes.attribute_details.options.graph.child_name_placeholder',
        defaultMessage: 'Name the new value',
    },
    childNameAria: {
        id: 'admin.global_attributes.attribute_details.options.graph.child_name_aria',
        defaultMessage: 'New value granted by {name}',
    },
    add: {
        id: 'admin.global_attributes.attribute_details.options.graph.add',
        defaultMessage: 'Add',
    },
    addValue: {
        id: 'admin.global_attributes.attribute_details.options.graph.add_value',
        defaultMessage: 'Add value',
    },
    cancel: {
        id: 'admin.global_attributes.attribute_details.options.graph.cancel',
        defaultMessage: 'Cancel',
    },
    addTopLevel: {
        id: 'admin.global_attributes.attribute_details.options.graph.add_top_level',
        defaultMessage: 'Add a top-level value',
    },
    duplicateName: {
        id: 'admin.global_attributes.attribute_details.options.graph.duplicate_name',
        defaultMessage: '"{name}" already exists in this field.',
    },
});
