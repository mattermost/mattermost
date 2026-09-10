// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DropIndicator} from '@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/border';
import classNames from 'classnames';
import React, {useState} from 'react';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';

import {
    ChevronDownIcon,
    ChevronRightIcon,
    DragVerticalIcon,
    LinkVariantIcon,
    PlusIcon,
    SitemapIcon,
    TrashCanOutlineIcon,
} from '@mattermost/compass-icons/components';
import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {PropertyFieldOption} from '@mattermost/types/properties';

import * as Menu from 'components/menu';
import {oxfordJoinNames} from 'components/property_fields/graph';
import type {GraphOccurrence} from 'components/property_fields/graph';

import {occurrenceHasChildren} from './occurrences';
import type {ConfirmGrant, ProposeParentResult} from './parent_ops';
import AttributeGraphParentsPane from './parents_pane';
import {useGraphRowDnd} from './use_graph_dnd';

export type GraphPaneView = 'main' | 'parents' | 'children';

export type GraphRowProps = {
    occurrence: GraphOccurrence;
    index: number;
    disabled: boolean;
    atMax: boolean;
    menuOpen: boolean;
    menuInitialView: GraphPaneView;
    expanded: boolean;
    onToggleCollapse: (key: string) => void;
    onOpenMenuAddChild: (occurrence: GraphOccurrence, index: number) => void;
    onOpenMenu: (key: string, view: GraphPaneView) => void;
    onCloseMenu: () => void;
    onRename: (currentName: string, nextName: string) => 'applied' | 'duplicate' | 'noop';
    onExpandOccurrence: (key: string) => void;
    onDelete: (optionName: string) => void;
    options: PropertyFieldOption[];
    onOptionsChange: (options: PropertyFieldOption[]) => void;
    onPaneOptionsChange: (options: PropertyFieldOption[]) => void;
    confirmGrant?: ConfirmGrant;
    onDropResult: (result: ProposeParentResult, names: {childName: string; parentName: string}) => void;
    highlighted: boolean;
    rowRefs: React.MutableRefObject<Map<string, HTMLLIElement>>;
    parentName: string | null;
};

export const GraphRow = React.memo(({
    occurrence,
    index,
    disabled,
    atMax,
    menuOpen,
    menuInitialView,
    expanded,
    onToggleCollapse,
    onOpenMenuAddChild,
    onOpenMenu,
    onCloseMenu,
    onRename,
    onExpandOccurrence,
    onDelete,
    options,
    onOptionsChange,
    onPaneOptionsChange,
    confirmGrant,
    onDropResult,
    highlighted,
    rowRefs,
    parentName,
}: GraphRowProps) => {
    const {formatMessage} = useIntl();
    const editValueLabel = formatMessage(messages.editValue, {name: occurrence.option.name});
    const addChildLabel = formatMessage(messages.addChildAria, {name: occurrence.option.name});
    const deleteLabel = formatMessage(messages.deleteAria, {name: occurrence.option.name});
    const dragHandleLabel = formatMessage(messages.dragHandleTooltip, {name: occurrence.option.name});
    const parentNames = occurrence.option.parents ?? [];
    const parentCount = parentNames.length;
    const hasChildren = occurrenceHasChildren(occurrence);
    const [rowElement, setRowElement] = useState<HTMLLIElement | null>(null);
    const [handleElement, setHandleElement] = useState<HTMLSpanElement | null>(null);

    const {isOver} = useGraphRowDnd({
        rowElement,
        handleElement,
        optionName: occurrence.option.name,
        parentName,
        options,
        onOptionsChange,
        confirmGrant,
        disabled,
        onDropResult,
    });

    const setRowRef = (el: HTMLLIElement | null) => {
        setRowElement(el);
        if (el) {
            rowRefs.current.set(occurrence.key, el);
        } else {
            rowRefs.current.delete(occurrence.key);
        }
    };

    const toggleMenu = (view: GraphPaneView) => {
        if (menuOpen && menuInitialView === view) {
            onCloseMenu();
            return;
        }
        onOpenMenu(occurrence.key, view);
    };

    const parentsBadge = parentCount >= 2 && (
        <button
            type='button'
            className={classNames('attribute-options-graph-values__parents-badge', {
                'attribute-options-graph-values__parents-badge--static': disabled,
            })}
            onClick={() => toggleMenu('parents')}
            disabled={disabled}
            data-testid='attributeOptionsGraphRow__parentsBadge'
        >
            <LinkVariantIcon
                size={12}
                aria-hidden={true}
            />
            <FormattedMessage
                {...messages.parentsBadge}
                values={{n: parentCount}}
            />
        </button>
    );

    return (
        <li
            ref={setRowRef}
            className={classNames('attribute-options-graph-values__row', {
                'attribute-options-graph-values__row--active': menuOpen,
                'attribute-options-graph-values__row--highlight': highlighted,
            })}
            style={{['--attribute-options-graph-values-indent' as string]: occurrence.depth}}
            data-testid='attributeOptionsGraphRow'
            data-option-name={occurrence.option.name}
            data-parent-name={parentName ?? ''}
            data-depth={String(occurrence.depth)}
            aria-expanded={hasChildren ? expanded : undefined}
            tabIndex={-1}
        >
            <span className='attribute-options-graph-values__gutter'>
                {hasChildren ? (
                    <button
                        type='button'
                        className='attribute-options-graph-values__collapse'
                        aria-label={formatMessage(expanded ? messages.collapse : messages.expand, {name: occurrence.option.name})}
                        aria-expanded={expanded}
                        onClick={() => onToggleCollapse(occurrence.key)}
                        data-testid='attributeOptionsGraphRow__collapse'
                    >
                        {expanded ? <ChevronDownIcon size={16}/> : <ChevronRightIcon size={16}/>}
                    </button>
                ) : (
                    <span
                        className='attribute-options-graph-values__collapse-spacer'
                        aria-hidden={true}
                    />
                )}
                <WithTooltip
                    title={dragHandleLabel}
                    hint={formatMessage(messages.dragHandleHint)}
                    disabled={disabled}
                >
                    <span
                        ref={setHandleElement}
                        className={classNames('attribute-options-graph-values__drag-handle', {
                            'attribute-options-graph-values__drag-handle--disabled': disabled,
                        })}
                        tabIndex={-1}
                        aria-hidden={true}
                        data-testid='attributeOptionsGraphRow__dragHandle'
                    >
                        <DragVerticalIcon size={16}/>
                    </span>
                </WithTooltip>
            </span>

            {disabled ? (
                <span
                    className='attribute-options-graph-values__name attribute-options-graph-values__name--static'
                    data-testid='attributeOptionsGraphRow__name'
                >
                    {occurrence.option.name}
                </span>
            ) : (
                <button
                    type='button'
                    className='attribute-options-graph-values__name'
                    onClick={() => toggleMenu('main')}
                    data-testid='attributeOptionsGraphRow__name'
                >
                    {occurrence.option.name}
                </button>
            )}

            {parentsBadge && (disabled ? parentsBadge : (
                <WithTooltip
                    title={formatMessage(messages.parentsBadgeTooltip, {names: oxfordJoinNames(parentNames)})}
                >
                    {parentsBadge}
                </WithTooltip>
            ))}

            <span className='attribute-options-graph-values__spacer'/>

            {!disabled && (
                <div className='attribute-options-graph-values__actions'>
                    <WithTooltip title={addChildLabel}>
                        <button
                            type='button'
                            className='btn btn-icon btn-xs attribute-options-graph-values__action'
                            aria-label={addChildLabel}
                            disabled={atMax}
                            onClick={() => onOpenMenuAddChild(occurrence, index)}
                            data-testid='attributeOptionsGraphRow__addChild'
                        >
                            <PlusIcon size={16}/>
                        </button>
                    </WithTooltip>
                    <WithTooltip title={formatMessage(messages.parentsActionTooltip)}>
                        <button
                            type='button'
                            className='btn btn-icon btn-xs attribute-options-graph-values__action'
                            aria-label={formatMessage(messages.parentsAria, {name: occurrence.option.name})}
                            onClick={() => toggleMenu('parents')}
                            data-testid='attributeOptionsGraphRow__parents'
                        >
                            <SitemapIcon size={16}/>
                        </button>
                    </WithTooltip>
                    <WithTooltip title={deleteLabel}>
                        <button
                            type='button'
                            className='btn btn-icon btn-xs attribute-options-graph-values__action attribute-options-graph-values__action--danger'
                            aria-label={deleteLabel}
                            onClick={() => onDelete(occurrence.option.name)}
                            data-testid='attributeOptionsGraphRow__delete'
                        >
                            <TrashCanOutlineIcon size={16}/>
                        </button>
                    </WithTooltip>
                </div>
            )}

            {menuOpen && (
                <Menu.Container
                    menuButton={{
                        id: `attribute-options-graph-row-parents-${index}`,
                        as: 'div',
                        class: 'attribute-options-graph-values__parents-anchor',
                        'aria-label': editValueLabel,
                        dataTestId: 'attributeOptionsGraphRow__parentsAnchor',
                        children: <span className='sr-only'>{editValueLabel}</span>,
                    }}
                    menu={{
                        id: `attribute-options-graph-row-parents-menu-${index}`,
                        className: 'attribute-graph-parents-pane',
                        width: '368px',
                        'aria-label': editValueLabel,
                        isMenuOpen: true,
                        onToggle: (open) => {
                            if (!open) {
                                onCloseMenu();
                            }
                        },
                    }}
                    anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
                    transformOrigin={{vertical: 'top', horizontal: 'right'}}
                >
                    <AttributeGraphParentsPane
                        key={`${occurrence.key}:${menuInitialView}`}
                        options={options}
                        optionName={occurrence.option.name}
                        onOptionsChange={onPaneOptionsChange}
                        onDelete={onDelete}
                        onRename={onRename}
                        onChildAdded={() => onExpandOccurrence(occurrence.key)}
                        disabled={disabled}
                        atMax={atMax}
                        confirmGrant={confirmGrant}
                        initialView={menuInitialView}
                    />
                </Menu.Container>
            )}
            {isOver && (
                <DropIndicator/>
            )}
        </li>
    );
});

const messages = defineMessages({
    parentsBadge: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_badge',
        defaultMessage: '{n} parents',
    },
    addChildAria: {
        id: 'admin.global_attributes.attribute_details.options.graph.add_child_aria',
        defaultMessage: 'Add a value under {name}',
    },
    editValue: {
        id: 'admin.global_attributes.attribute_details.options.graph.edit_value',
        defaultMessage: 'Edit {name}',
    },
    parentsAria: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_aria',
        defaultMessage: 'Parents of {name}',
    },
    parentsActionTooltip: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_action_tooltip',
        defaultMessage: 'Parents — who this value is granted by',
    },
    parentsBadgeTooltip: {
        id: 'admin.global_attributes.attribute_details.options.graph.parents_badge_tooltip',
        defaultMessage: 'Under {names}',
    },
    collapse: {
        id: 'admin.global_attributes.attribute_details.options.graph.collapse',
        defaultMessage: 'Collapse {name}',
    },
    expand: {
        id: 'admin.global_attributes.attribute_details.options.graph.expand',
        defaultMessage: 'Expand {name}',
    },
    deleteAria: {
        id: 'admin.global_attributes.attribute_details.options.graph.delete_aria',
        defaultMessage: 'Delete {name}',
    },
    dragHandleTooltip: {
        id: 'admin.global_attributes.attribute_details.options.graph.drag_handle_tooltip',
        defaultMessage: 'Drag to move {name}',
    },
    dragHandleHint: {
        id: 'admin.global_attributes.attribute_details.options.graph.drag_handle_hint',
        defaultMessage: 'Drop on a row to nest it under that value. Order in the list carries no meaning.',
    },
});
