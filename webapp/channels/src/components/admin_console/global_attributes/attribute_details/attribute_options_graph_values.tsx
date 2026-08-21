// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';

import {PlusIcon, SitemapIcon} from '@mattermost/compass-icons/components';
import {Button} from '@mattermost/shared/components/button';
import type {PropertyFieldOption} from '@mattermost/types/properties';

import Input from 'components/widgets/inputs/input/input';

import Constants from 'utils/constants';

import {
    addTopLevelOption,
    isNameUnique,
    wouldExceedMaxEdges,
    wouldExceedMaxOptions,
} from './graph_utils';

import './attribute_options_graph_values.scss';

type Props = {
    options: PropertyFieldOption[];
    onOptionsChange: (options: PropertyFieldOption[]) => void;
    disabled?: boolean;
};

type AddTopLevelFormProps = {
    testIdPrefix: 'attributeOptionsGraphEmpty' | 'attributeOptionsGraphAddTop';
    draftName: string;
    onDraftNameChange: (value: string) => void;
    isDuplicate: boolean;
    trimmed: string;
    atMax: boolean;
    canAdd: boolean;
    disabled: boolean;
    onCommit: () => void;
};

const AddTopLevelForm = ({
    testIdPrefix,
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
    const isEmptyCanvas = testIdPrefix === 'attributeOptionsGraphEmpty';

    return (
        <div className={isEmptyCanvas ? 'attribute-options-graph-values__empty-form' : 'attribute-options-graph-values__add-top'}>
            <Input
                name={isEmptyCanvas ? 'graph_empty_option_name' : 'graph_add_top_option_name'}
                type='text'
                useLegend={false}
                placeholder={formatMessage(messages.namePlaceholder)}
                aria-label={isEmptyCanvas ? undefined : formatMessage(messages.addTopLevel)}
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
                customMessage={isDuplicate
                    ? {type: 'error', value: formatMessage(messages.duplicateName, {name: trimmed})}
                    : null}
                data-testid={`${testIdPrefix}__nameInput`}
            />
            <Button
                type='button'
                emphasis='primary'
                onClick={onCommit}
                disabled={!canAdd}
                aria-label={isEmptyCanvas ? undefined : formatMessage(messages.addTopLevel)}
                data-testid={`${testIdPrefix}__addButton`}
            >
                <PlusIcon size={16}/>
                <FormattedMessage {...messages.addValue}/>
            </Button>
        </div>
    );
};

const AttributeOptionsGraphValues = ({options, onOptionsChange, disabled = false}: Props) => {
    const [draftName, setDraftName] = useState('');

    const trimmed = draftName.trim();
    const nameIsUnique = useMemo(() => isNameUnique(options, trimmed), [options, trimmed]);
    const isDuplicate = Boolean(trimmed) && !nameIsUnique;
    const atMax = useMemo(
        () => wouldExceedMaxOptions(options) || wouldExceedMaxEdges(options),
        [options],
    );
    const canAdd = Boolean(trimmed) && nameIsUnique && !atMax && !disabled;

    const commitTopLevel = useCallback(() => {
        const name = draftName.trim();
        if (!name || !isNameUnique(options, name) || wouldExceedMaxOptions(options) || wouldExceedMaxEdges(options) || disabled) {
            return;
        }
        onOptionsChange(addTopLevelOption(options, name));
        setDraftName('');
    }, [draftName, options, onOptionsChange, disabled]);

    const addForm = (
        <AddTopLevelForm
            testIdPrefix={options.length === 0 ? 'attributeOptionsGraphEmpty' : 'attributeOptionsGraphAddTop'}
            draftName={draftName}
            onDraftNameChange={setDraftName}
            isDuplicate={isDuplicate}
            trimmed={trimmed}
            atMax={atMax}
            canAdd={canAdd}
            disabled={disabled}
            onCommit={commitTopLevel}
        />
    );

    return (
        <div
            className='attribute-options-graph-values'
            data-testid='attributeOptionsGraphValues'
        >
            <p className='attribute-options-graph-values__helper'>
                <FormattedMessage {...messages.helper}/>
            </p>
            {options.length === 0 ? (
                <div
                    className='attribute-options-graph-values__empty-canvas'
                    data-testid='attributeOptionsGraphEmpty'
                >
                    <div
                        className='attribute-options-graph-values__empty-icon'
                        aria-hidden={true}
                    >
                        <SitemapIcon size={48}/>
                    </div>
                    <h3 className='attribute-options-graph-values__empty-heading'>
                        <FormattedMessage {...messages.emptyHeading}/>
                    </h3>
                    <p className='attribute-options-graph-values__empty-body'>
                        <FormattedMessage {...messages.emptyBody}/>
                    </p>
                    {addForm}
                </div>
            ) : (
                <>
                    <ul
                        className='attribute-options-graph-values__list'
                        data-testid='attributeOptionsGraphList'
                    >
                        {options.map((option) => (
                            <li
                                key={option.id || option.name}
                                className='attribute-options-graph-values__row'
                            >
                                {option.name}
                            </li>
                        ))}
                    </ul>
                    {addForm}
                </>
            )}
            <p className='attribute-options-graph-values__footer'>
                <FormattedMessage {...messages.footer}/>
            </p>
        </div>
    );
};

export default AttributeOptionsGraphValues;

const messages = defineMessages({
    helper: {
        id: 'admin.global_attributes.attribute_details.options.graph.helper',
        defaultMessage: 'Each value can have parents and children.',
    },
    emptyHeading: {
        id: 'admin.global_attributes.attribute_details.options.graph.empty.heading',
        defaultMessage: 'Add the first value',
    },
    emptyBody: {
        id: 'admin.global_attributes.attribute_details.options.graph.empty.body',
        defaultMessage: 'Start with a top-level value. You can add parents and children from its row.',
    },
    namePlaceholder: {
        id: 'admin.global_attributes.attribute_details.options.graph.name_placeholder',
        defaultMessage: 'Value name',
    },
    addValue: {
        id: 'admin.global_attributes.attribute_details.options.graph.add_value',
        defaultMessage: 'Add value',
    },
    addTopLevel: {
        id: 'admin.global_attributes.attribute_details.options.graph.add_top_level',
        defaultMessage: 'Add top-level value',
    },
    footer: {
        id: 'admin.global_attributes.attribute_details.options.graph.footer',
        defaultMessage: 'Up to 100 parents per value, 100 levels deep.',
    },
    duplicateName: {
        id: 'admin.global_attributes.attribute_details.options.graph.duplicate_name',
        defaultMessage: '"{name}" already exists in this field.',
    },
});
