// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useState} from 'react';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';
import type {MessageDescriptor} from 'react-intl';

import {
    ChevronLeftIcon,
    CloseIcon,
    PlusIcon,
} from '@mattermost/compass-icons/components';
import {Button} from '@mattermost/shared/components/button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import * as Menu from 'components/menu';
import Input from 'components/widgets/inputs/input/input';

import {GraphParentEdgeAlert} from './edge_alert';
import type {EdgeDirection, Suggestion} from './edge_candidates';
import type {CheckParentEdgeInvalid} from './graph_utils';

export type EdgeListLabels = {
    back: MessageDescriptor;
    empty: MessageDescriptor;
    emptyTestId: string;
    rowTestId: string;
    removeTestId: string;
    removeAria: MessageDescriptor;
    searchName: string;
    searchTestId: string;
    searchPlaceholder: MessageDescriptor;
    searchAria: MessageDescriptor;
    suggestionsTestId: string;
    createTestId: string;
    confirmRemoval: boolean;
    removeTooltip?: MessageDescriptor;
    anchorIs: 'parent' | 'child';
};

export function edgeListLabels(direction: EdgeDirection): EdgeListLabels {
    switch (direction) {
    case 'children':
        return {
            back: messages.childrenOf,
            empty: messages.noChildrenYet,
            emptyTestId: 'attributeGraphParentsPane__childrenEmpty',
            rowTestId: 'attributeGraphParentsPane__childRow',
            removeTestId: 'attributeGraphParentsPane__childRemove',
            removeAria: messages.removeChild,
            searchName: 'attributeGraphParentsPane__childSearch',
            searchTestId: 'attributeGraphParentsPane__childSearch',
            searchPlaceholder: messages.addChildPlaceholder,
            searchAria: messages.addChildAria,
            suggestionsTestId: 'attributeGraphParentsPane__childSuggestions',
            createTestId: 'attributeGraphParentsPane__createChild',
            confirmRemoval: false,
            anchorIs: 'parent',
        };
    case 'parents':
        return {
            back: messages.parentsOf,
            empty: messages.noParentsYet,
            emptyTestId: 'attributeGraphParentsPane__empty',
            rowTestId: 'attributeGraphParentsPane__parentRow',
            removeTestId: 'attributeGraphParentsPane__parentRemove',
            removeAria: messages.removeParent,
            searchName: 'attributeGraphParentsPane__search',
            searchTestId: 'attributeGraphParentsPane__search',
            searchPlaceholder: messages.addParentPlaceholder,
            searchAria: messages.addParentAria,
            suggestionsTestId: 'attributeGraphParentsPane__suggestions',
            createTestId: 'attributeGraphParentsPane__create',
            confirmRemoval: true,
            removeTooltip: messages.removeParentTooltip,
            anchorIs: 'child',
        };
    default: {
        const exhaustive: never = direction;
        return exhaustive;
    }
    }
}

export type EdgeListProps = {
    direction: EdgeDirection;
    optionName: string;
    relatedNames: string[];
    query: string;
    searchOpen: boolean;
    suggestions: Suggestion[];
    edgeAlert: CheckParentEdgeInvalid | null;
    alertRelatedName: string;
    disabled: boolean;
    atMax: boolean;
    descendantCount: number;
    onBack: () => void;
    onQueryChange: (value: string) => void;
    onSearchOpen: () => void;
    onAddExisting: (name: string) => void;
    onCreate: (name: string) => void;
    onRemoveEdge: (childName: string, parentName: string) => void;
};

export function EdgeList({
    direction,
    optionName,
    relatedNames,
    query,
    searchOpen,
    suggestions,
    edgeAlert,
    alertRelatedName,
    disabled,
    atMax,
    descendantCount,
    onBack,
    onQueryChange,
    onSearchOpen,
    onAddExisting,
    onCreate,
    onRemoveEdge,
}: EdgeListProps) {
    const {formatMessage} = useIntl();
    const [confirmingRelated, setConfirmingRelated] = useState<string | null>(null);

    const handleSearchKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
        event.stopPropagation();
        if (event.key !== 'Enter') {
            return;
        }
        event.preventDefault();
        if (disabled || atMax) {
            return;
        }
        const existing = suggestions.filter((row) => row.kind === 'existing');
        const create = suggestions.find((row) => row.kind === 'create');
        if (existing.length === 1 && !create) {
            onAddExisting(existing[0].name);
            return;
        }
        if (existing.length === 0 && create) {
            onCreate(create.name);
        }
    }, [atMax, disabled, onAddExisting, onCreate, suggestions]);

    const labels = edgeListLabels(direction);
    const showSuggestions = searchOpen && suggestions.length > 0 && !disabled;
    const alertChildName = labels.anchorIs === 'parent' ? alertRelatedName : optionName;
    const alertParentName = labels.anchorIs === 'parent' ? optionName : alertRelatedName;

    return (
        <>
            <button
                type='button'
                className='attribute-graph-parents-pane__back'
                data-testid='attributeGraphParentsPane__back'
                onClick={onBack}
            >
                <ChevronLeftIcon size={16}/>
                <FormattedMessage
                    {...labels.back}
                    values={{name: optionName}}
                />
            </button>
            <div className='attribute-graph-parents-pane__rows'>
                {relatedNames.length === 0 && (
                    <p
                        className='attribute-graph-parents-pane__empty'
                        data-testid={labels.emptyTestId}
                    >
                        <FormattedMessage {...labels.empty}/>
                    </p>
                )}
                {relatedNames.map((relatedName) => {
                    const isConfirming = Boolean(labels.confirmRemoval && confirmingRelated === relatedName);
                    const removeAriaValues = labels.anchorIs === 'parent' ?
                        {parent: optionName, child: relatedName} :
                        {parent: relatedName, child: optionName};
                    const removeButton = (
                        <button
                            type='button'
                            className='attribute-graph-parents-pane__row-remove'
                            data-testid={labels.removeTestId}
                            aria-label={formatMessage(labels.removeAria, removeAriaValues)}
                            disabled={disabled}
                            onClick={() => {
                                if (labels.confirmRemoval) {
                                    setConfirmingRelated(relatedName);
                                    return;
                                }
                                const removeChildName = labels.anchorIs === 'parent' ? relatedName : optionName;
                                const removeParentName = labels.anchorIs === 'parent' ? optionName : relatedName;
                                onRemoveEdge(removeChildName, removeParentName);
                            }}
                        >
                            <CloseIcon
                                size={12}
                                aria-hidden={true}
                            />
                        </button>
                    );

                    return (
                        <div
                            key={relatedName}
                            className={classNames('attribute-graph-parents-pane__row', {
                                'attribute-graph-parents-pane__row--confirming': isConfirming,
                            })}
                            data-testid={labels.rowTestId}
                        >
                            <div className='attribute-graph-parents-pane__row-top'>
                                <span className='attribute-graph-parents-pane__row-label'>{relatedName}</span>
                                {labels.removeTooltip ? (
                                    <WithTooltip title={formatMessage(labels.removeTooltip)}>
                                        {removeButton}
                                    </WithTooltip>
                                ) : removeButton}
                            </div>
                            {isConfirming && (
                                <div
                                    className='attribute-graph-parents-pane__confirm'
                                    data-testid='attributeGraphParentsPane__parentRemoveConfirm'
                                >
                                    <p className='attribute-graph-parents-pane__confirm-text'>
                                        <FormattedMessage
                                            {...(descendantCount > 0 ? messages.removeConfirmWithDescendants : messages.removeConfirm)}
                                            values={{
                                                child: optionName,
                                                parent: relatedName,
                                                count: descendantCount,
                                            }}
                                        />
                                    </p>
                                    <div className='attribute-graph-parents-pane__confirm-actions'>
                                        <Button
                                            type='button'
                                            emphasis='secondary'
                                            size='sm'
                                            variant='destructive'
                                            disabled={disabled}
                                            onClick={() => {
                                                onRemoveEdge(optionName, relatedName);
                                                setConfirmingRelated(null);
                                            }}
                                            data-testid='attributeGraphParentsPane__parentRemoveConfirmButton'
                                        >
                                            <FormattedMessage {...messages.removeTheParent}/>
                                        </Button>
                                        <Button
                                            type='button'
                                            emphasis='tertiary'
                                            size='sm'
                                            onClick={() => setConfirmingRelated(null)}
                                            data-testid='attributeGraphParentsPane__parentRemoveKeep'
                                        >
                                            <FormattedMessage {...messages.keepIt}/>
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            {edgeAlert && (
                <GraphParentEdgeAlert
                    result={edgeAlert}
                    childName={alertChildName}
                    parentName={alertParentName}
                    className='attribute-graph-parents-pane__alert'
                    testId='attributeGraphParentsPane__alert'
                />
            )}
            <Menu.Separator/>
            <div className='attribute-graph-parents-pane__combobox'>
                <Input
                    name={labels.searchName}
                    type='text'
                    useLegend={false}
                    placeholder={formatMessage(labels.searchPlaceholder)}
                    aria-label={formatMessage(labels.searchAria, {name: optionName})}
                    value={query}
                    onChange={(event) => onQueryChange(event.target.value)}
                    onFocus={onSearchOpen}
                    onKeyDown={handleSearchKeyDown}
                    onKeyUp={(event) => event.stopPropagation()}
                    disabled={disabled || atMax}
                    autoComplete='off'
                    data-testid={labels.searchTestId}
                />
                {showSuggestions && (
                    <ul
                        className='attribute-graph-parents-pane__suggestions'
                        role='listbox'
                        data-testid={labels.suggestionsTestId}
                    >
                        {suggestions.map((row) => {
                            if (row.kind === 'create') {
                                return (
                                    <li
                                        key='__create'
                                        role='option'
                                    >
                                        <button
                                            type='button'
                                            className='attribute-graph-parents-pane__suggestion attribute-graph-parents-pane__suggestion--create'
                                            data-testid={labels.createTestId}
                                            disabled={disabled || atMax}
                                            onMouseDown={(event) => event.preventDefault()}
                                            onClick={() => onCreate(row.name)}
                                        >
                                            <PlusIcon
                                                size={16}
                                                aria-hidden={true}
                                            />
                                            <FormattedMessage
                                                {...messages.createParent}
                                                values={{name: row.name}}
                                            />
                                        </button>
                                    </li>
                                );
                            }
                            return (
                                <li
                                    key={row.name}
                                    role='option'
                                >
                                    <button
                                        type='button'
                                        className='attribute-graph-parents-pane__suggestion'
                                        data-testid={`attributeGraphParentsPane__candidate-${row.name}`}
                                        disabled={disabled || atMax}
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={() => onAddExisting(row.name)}
                                    >
                                        {row.name}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </>
    );
}

const messages = defineMessages({
    childrenOf: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.children_back',
        defaultMessage: 'Children of {name}',
    },
    parentsOf: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.back',
        defaultMessage: 'Parents of {name}',
    },
    noParentsYet: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.no_parents',
        defaultMessage: 'No parents yet.',
    },
    noChildrenYet: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.no_children',
        defaultMessage: 'No children yet.',
    },
    addChildPlaceholder: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.add_child',
        defaultMessage: 'Grant another value, or type a new name…',
    },
    addChildAria: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.add_child_aria',
        defaultMessage: 'Add a value granted by {name}',
    },
    removeChild: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.remove_child',
        defaultMessage: 'Remove {child} as a child of {parent}',
    },
    addParentPlaceholder: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.add_parent',
        defaultMessage: 'Add a parent, or type a new name…',
    },
    addParentAria: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.add_parent_aria',
        defaultMessage: 'Add a parent of {name}',
    },
    createParent: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.create_parent',
        defaultMessage: 'Create "{name}"',
    },
    removeParent: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.remove_parent',
        defaultMessage: 'Remove {parent} as a parent of {child}',
    },
    removeParentTooltip: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.remove_parent_tooltip',
        defaultMessage: 'Remove Parent',
    },
    removeConfirm: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.remove_confirm',
        defaultMessage: 'Remove it? "{child}" will no longer sit under "{parent}".',
    },
    removeConfirmWithDescendants: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.remove_confirm_with_descendants',
        defaultMessage: 'Remove it? "{child}" will no longer sit under "{parent}", or under anything above it. The {count, plural, one {# value} other {# values}} below "{child}" go with it.',
    },
    removeTheParent: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.remove_confirm_action',
        defaultMessage: 'Remove the parent',
    },
    keepIt: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_pane.keep_it',
        defaultMessage: 'Keep it',
    },
});
