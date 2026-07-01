// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable formatjs/no-literal-string-in-jsx -- component library dev playground */

import classNames from 'classnames';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {Button} from '@mattermost/shared/components/button';
import type {MmBlock, MmColumnBlock} from '@mattermost/types/mm_blocks';

import {
    type AddBlockTarget,
    type BlockPath,
    type BlockTypeId,
    type ChildListKey,
    MM_BLOCKS_DRAG_MIME,
    ROOT_ADDABLE_TYPES,
    addableTypesForList,
    blockSummary,
    blockTypeLabel,
    canAddChild,
    childPaths,
    createDefaultBlock,
    formatPropertyValue,
    getBlockAt,
    getPropertyValue,
    insertBlockAt,
    listLabel,
    moveBlockAt,
    parsePathKey,
    pathKey,
    propertyFieldsForBlock,
    remapPathAfterMove,
    removeBlockAt,
    sameParentList,
    setPropertyValue,
    type PropertyField,
    updateBlockAt,
} from './mm_blocks_editor_utils';

import './mm_blocks_hierarchy_editor.scss';

type Props = {
    blocks: MmBlock[];
    selectedPath: BlockPath | null;
    onSelectPath: (path: BlockPath | null) => void;
    onChangeBlocks: (blocks: MmBlock[]) => void;
};

type AddMenuState = {
    path: BlockPath;
};

const PropertyFieldEditor = ({
    block,
    field,
    onChange,
}: {
    block: MmBlock | MmColumnBlock;
    field: PropertyField;
    onChange: (next: MmBlock | MmColumnBlock) => void;
}) => {
    const value = getPropertyValue(block, field.key);
    const display = formatPropertyValue(value, field);
    const id = `mm-block-prop-${field.key}`;

    const onStringChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        onChange(setPropertyValue(block, field.key, e.target.value, field));
    }, [block, field, onChange]);

    const onBooleanChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(setPropertyValue(block, field.key, e.target.checked ? 'true' : '', field));
    }, [block, field, onChange]);

    const onEnumChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        onChange(setPropertyValue(block, field.key, e.target.value, field));
    }, [block, field, onChange]);

    if (field.type === 'boolean') {
        return (
            <label className='MmBlocksHierarchyEditor__propertyRow'>
                <span className='MmBlocksHierarchyEditor__propertyLabel'>{field.label}</span>
                <input
                    id={id}
                    type='checkbox'
                    checked={value === true}
                    onChange={onBooleanChange}
                />
            </label>
        );
    }

    if (field.type === 'enum' && field.options) {
        return (
            <label className='MmBlocksHierarchyEditor__propertyRow'>
                <span className='MmBlocksHierarchyEditor__propertyLabel'>{field.label}</span>
                <select
                    id={id}
                    value={display}
                    onChange={onEnumChange}
                >
                    <option value=''>{'(unset)'}</option>
                    {field.options.map((opt) => (
                        <option
                            key={opt}
                            value={opt}
                        >
                            {opt}
                        </option>
                    ))}
                </select>
            </label>
        );
    }

    if (field.type === 'json') {
        return (
            <label className='MmBlocksHierarchyEditor__propertyRow MmBlocksHierarchyEditor__propertyRow--stacked'>
                <span className='MmBlocksHierarchyEditor__propertyLabel'>{field.label}</span>
                <textarea
                    id={id}
                    className='MmBlocksHierarchyEditor__propertyJson'
                    spellCheck={false}
                    rows={4}
                    value={display}
                    placeholder={field.placeholder ?? 'JSON'}
                    onChange={onStringChange}
                />
            </label>
        );
    }

    const isLong = field.key === 'text';
    return (
        <label
            className={classNames('MmBlocksHierarchyEditor__propertyRow', {
                'MmBlocksHierarchyEditor__propertyRow--stacked': isLong,
            })}
        >
            <span className='MmBlocksHierarchyEditor__propertyLabel'>{field.label}</span>
            {isLong ? (
                <textarea
                    id={id}
                    className='MmBlocksHierarchyEditor__propertyJson'
                    spellCheck={false}
                    rows={3}
                    value={display}
                    placeholder={field.placeholder}
                    onChange={onStringChange}
                />
            ) : (
                <input
                    id={id}
                    type={field.type === 'number' ? 'number' : 'text'}
                    value={display}
                    placeholder={field.placeholder}
                    onChange={onStringChange}
                />
            )}
        </label>
    );
};

const AddBlockMenu = ({
    addableTypes,
    childAddableTypes,
    onPick,
    onPickChild,
    onClose,
}: {
    addableTypes: BlockTypeId[];
    childAddableTypes?: BlockTypeId[];
    onPick: (type: BlockTypeId) => void;
    onPickChild?: (type: BlockTypeId) => void;
    onClose: () => void;
}) => {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onDocClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, [onClose]);

    return (
        <div
            ref={ref}
            className='MmBlocksHierarchyEditor__addMenu'
            role='menu'
        >
            {childAddableTypes && onPickChild && childAddableTypes.length > 0 && (
                <>
                    <div className='MmBlocksHierarchyEditor__addMenuHeading'>{'Inside block'}</div>
                    {childAddableTypes.map((type) => (
                        <button
                            key={`child-${type}`}
                            type='button'
                            className='MmBlocksHierarchyEditor__addMenuItem'
                            role='menuitem'
                            onClick={() => onPickChild(type)}
                        >
                            {blockTypeLabel(type)}
                        </button>
                    ))}
                    <div className='MmBlocksHierarchyEditor__addMenuHeading'>{'After block'}</div>
                </>
            )}
            {addableTypes.map((type) => (
                <button
                    key={type}
                    type='button'
                    className='MmBlocksHierarchyEditor__addMenuItem'
                    role='menuitem'
                    onClick={() => onPick(type)}
                >
                    {blockTypeLabel(type)}
                </button>
            ))}
        </div>
    );
};

type HierarchyNodeProps = {
    root: MmBlock[];
    block: MmBlock | MmColumnBlock;
    path: BlockPath;
    depth: number;
    selectedPath: BlockPath | null;
    draggingPath: BlockPath | null;
    dragOverPath: BlockPath | null;
    addMenu: AddMenuState | null;
    onSelectPath: (path: BlockPath) => void;
    onOpenAddMenu: (state: AddMenuState) => void;
    onCloseAddMenu: () => void;
    onAddBlock: (path: BlockPath, type: BlockTypeId, target: AddBlockTarget) => void;
    onRemoveBlock: (path: BlockPath) => void;
    onDragStart: (path: BlockPath) => void;
    onDragOver: (path: BlockPath) => void;
    onDragEnd: () => void;
    onDrop: (fromPath: BlockPath, toIndex: number) => void;
};

const HierarchyNode = ({
    root,
    block,
    path,
    depth,
    selectedPath,
    draggingPath,
    dragOverPath,
    addMenu,
    onSelectPath,
    onOpenAddMenu,
    onCloseAddMenu,
    onAddBlock,
    onRemoveBlock,
    onDragStart,
    onDragOver,
    onDragEnd,
    onDrop,
}: HierarchyNodeProps) => {
    const key = pathKey(path);
    const isSelected = selectedPath !== null && pathKey(selectedPath) === key;
    const isDragging = draggingPath !== null && pathKey(draggingPath) === key;
    const isDragOver = dragOverPath !== null && pathKey(dragOverPath) === key && !isDragging;
    const canDrop = draggingPath !== null && sameParentList(draggingPath, path);
    const parentList = path[path.length - 1]?.list ?? 'root';
    const supportsChild = canAddChild(block);
    const menuOpen = addMenu !== null && pathKey(addMenu.path) === key;

    const childListKey = useMemo((): ChildListKey | null => {
        switch (block.type) {
        case 'container':
            return 'content';
        case 'column':
            return 'items';
        case 'column_set':
            return 'columns';
        case 'collapsible':
            return 'content';
        default:
            return null;
        }
    }, [block.type]);

    const siblingTypes = addableTypesForList(parentList);
    const childTypes = supportsChild && childListKey ? addableTypesForList(childListKey) : [];

    const onSelect = useCallback(() => {
        onSelectPath(path);
    }, [onSelectPath, path]);

    const onRemove = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onRemoveBlock(path);
    }, [onRemoveBlock, path]);

    const onAdd = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        onOpenAddMenu({path});
    }, [onOpenAddMenu, path]);

    const onHandleDragStart = useCallback((e: React.DragEvent) => {
        e.stopPropagation();
        e.dataTransfer.setData(MM_BLOCKS_DRAG_MIME, key);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(path);
    }, [key, onDragStart, path]);

    const onRowDragOver = useCallback((e: React.DragEvent) => {
        if (!draggingPath || !sameParentList(draggingPath, path)) {
            return;
        }
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        onDragOver(path);
    }, [draggingPath, onDragOver, path]);

    const onRowDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const fromKey = e.dataTransfer.getData(MM_BLOCKS_DRAG_MIME);
        const fromPath = parsePathKey(fromKey);
        if (!fromPath || !sameParentList(fromPath, path)) {
            onDragEnd();
            return;
        }
        onDrop(fromPath, path[path.length - 1].index);
        onDragEnd();
    }, [onDragEnd, onDrop, path]);

    const childPathList = useMemo(() => childPaths(block, path), [block, path]);

    const childGroups = useMemo(() => {
        const groups: Array<{list: ChildListKey; label: string | null; paths: BlockPath[]}> = [];
        for (const childPath of childPathList) {
            const segment = childPath[childPath.length - 1];
            const last = groups[groups.length - 1];
            if (last && last.list === segment.list) {
                last.paths.push(childPath);
            } else {
                groups.push({
                    list: segment.list,
                    label: listLabel(segment.list),
                    paths: [childPath],
                });
            }
        }
        return groups;
    }, [childPathList]);

    return (
        <li className='MmBlocksHierarchyEditor__node'>
            {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- drop target for reorder */}
            <div
                className={classNames('MmBlocksHierarchyEditor__row', {
                    'is-selected': isSelected,
                    'is-dragging': isDragging,
                    'is-drag-over': isDragOver,
                    'can-drop': canDrop,
                })}
                style={{paddingLeft: `${(depth * 12) + 8}px`}}
                onDragOver={onRowDragOver}
                onDrop={onRowDrop}
            >
                <button
                    type='button'
                    className='MmBlocksHierarchyEditor__dragHandle'
                    draggable={true}
                    onDragStart={onHandleDragStart}
                    onDragEnd={onDragEnd}
                    onClick={(e) => e.preventDefault()}
                    aria-label='Drag to reorder'
                    title='Drag to reorder'
                >
                    {'⠿'}
                </button>
                <button
                    type='button'
                    className='MmBlocksHierarchyEditor__rowButton'
                    onClick={onSelect}
                    aria-pressed={isSelected}
                >
                    <span className='MmBlocksHierarchyEditor__type'>{block.type}</span>
                    <span className='MmBlocksHierarchyEditor__summary'>{blockSummary(block)}</span>
                </button>
                <div className='MmBlocksHierarchyEditor__rowActions'>
                    <Button
                        size='xs'
                        emphasis='quaternary'
                        onClick={onAdd}
                        aria-label='Add block'
                    >
                        {'+'}
                    </Button>
                    <Button
                        size='xs'
                        emphasis='quaternary'
                        onClick={onRemove}
                        aria-label='Remove block'
                    >
                        {'×'}
                    </Button>
                </div>
                {menuOpen && addMenu && pathKey(addMenu.path) === key && (
                    <AddBlockMenu
                        addableTypes={siblingTypes}
                        childAddableTypes={childTypes}
                        onPick={(type) => {
                            onAddBlock(addMenu.path, type, 'sibling');
                            onCloseAddMenu();
                        }}
                        onPickChild={childTypes.length > 0 ? (type) => {
                            onAddBlock(addMenu.path, type, 'child');
                            onCloseAddMenu();
                        } : undefined}
                        onClose={onCloseAddMenu}
                    />
                )}
            </div>
            {childGroups.length > 0 && (
                <ul className='MmBlocksHierarchyEditor__children'>
                    {childGroups.map((group) => (
                        <React.Fragment key={`${key}/${group.list}`}>
                            {group.label && (
                                <li
                                    className='MmBlocksHierarchyEditor__listLabel'
                                    style={{paddingLeft: `${((depth + 1) * 12) + 8}px`}}
                                >
                                    {group.label}
                                </li>
                            )}
                            {group.paths.map((childPath) => {
                                const childBlock = getBlockAt(root, childPath);
                                if (!childBlock) {
                                    return null;
                                }
                                return (
                                    <HierarchyNode
                                        key={pathKey(childPath)}
                                        root={root}
                                        block={childBlock}
                                        path={childPath}
                                        depth={depth + 1}
                                        selectedPath={selectedPath}
                                        draggingPath={draggingPath}
                                        dragOverPath={dragOverPath}
                                        addMenu={addMenu}
                                        onSelectPath={onSelectPath}
                                        onOpenAddMenu={onOpenAddMenu}
                                        onCloseAddMenu={onCloseAddMenu}
                                        onAddBlock={onAddBlock}
                                        onRemoveBlock={onRemoveBlock}
                                        onDragStart={onDragStart}
                                        onDragOver={onDragOver}
                                        onDragEnd={onDragEnd}
                                        onDrop={onDrop}
                                    />
                                );
                            })}
                        </React.Fragment>
                    ))}
                </ul>
            )}
        </li>
    );
};

const MmBlocksHierarchyEditor = ({
    blocks,
    selectedPath,
    onSelectPath,
    onChangeBlocks,
}: Props) => {
    const [addMenu, setAddMenu] = useState<AddMenuState | null>(null);
    const [rootAddOpen, setRootAddOpen] = useState(false);
    const [draggingPath, setDraggingPath] = useState<BlockPath | null>(null);
    const [dragOverPath, setDragOverPath] = useState<BlockPath | null>(null);

    const selectedBlock = useMemo(() => {
        if (!selectedPath) {
            return null;
        }
        return getBlockAt(blocks, selectedPath);
    }, [blocks, selectedPath]);

    const propertyFields = useMemo(() => {
        if (!selectedBlock) {
            return [];
        }
        return propertyFieldsForBlock(selectedBlock);
    }, [selectedBlock]);

    const onCloseAddMenu = useCallback(() => {
        setAddMenu(null);
    }, []);

    const onAddBlock = useCallback((path: BlockPath, type: BlockTypeId, target: AddBlockTarget) => {
        const newBlock = createDefaultBlock(type);
        const next = insertBlockAt(blocks, path, newBlock, target);
        onChangeBlocks(next);
        if (target === 'child') {
            const parent = getBlockAt(next, path);
            if (!parent || !canAddChild(parent)) {
                return;
            }
            let childList: ChildListKey = 'content';
            let listLength = 0;
            if (parent.type === 'container') {
                childList = 'content';
                listLength = parent.content.length;
            } else if (parent.type === 'column') {
                childList = 'items';
                listLength = parent.items.length;
            } else if (parent.type === 'column_set') {
                childList = 'columns';
                listLength = parent.columns.length;
            } else if (parent.type === 'collapsible') {
                childList = 'content';
                listLength = parent.content.length;
            }
            onSelectPath([...path, {list: childList, index: listLength - 1}]);
        }
    }, [blocks, onChangeBlocks, onSelectPath]);

    const onRemoveBlock = useCallback((path: BlockPath) => {
        const next = removeBlockAt(blocks, path);
        onChangeBlocks(next);
        if (selectedPath && pathKey(selectedPath) === pathKey(path)) {
            onSelectPath(null);
        }
    }, [blocks, onChangeBlocks, onSelectPath, selectedPath]);

    const onDragEnd = useCallback(() => {
        setDraggingPath(null);
        setDragOverPath(null);
    }, []);

    const onDrop = useCallback((fromPath: BlockPath, toIndex: number) => {
        const next = moveBlockAt(blocks, fromPath, toIndex);
        onChangeBlocks(next);
        if (selectedPath) {
            onSelectPath(remapPathAfterMove(selectedPath, fromPath, toIndex));
        }
    }, [blocks, onChangeBlocks, onSelectPath, selectedPath]);

    const onPropertyChange = useCallback((next: MmBlock | MmColumnBlock) => {
        if (!selectedPath) {
            return;
        }
        onChangeBlocks(updateBlockAt(blocks, selectedPath, next));
    }, [blocks, onChangeBlocks, selectedPath]);

    const rootPaths = useMemo(
        () => blocks.map((_, index): BlockPath => [{list: 'root', index}]),
        [blocks],
    );

    return (
        <div className='MmBlocksHierarchyEditor'>
            <div className='MmBlocksHierarchyEditor__treePanel'>
                <h3 className='MmBlocksHierarchyEditor__heading'>{'Block hierarchy'}</h3>
                {blocks.length === 0 ? (
                    <div className='MmBlocksHierarchyEditor__emptyRoot'>
                        <p className='MmBlocksHierarchyEditor__empty'>{'No blocks yet.'}</p>
                        <div className='MmBlocksHierarchyEditor__emptyAdd'>
                            <Button
                                size='xs'
                                onClick={() => setRootAddOpen((open) => !open)}
                            >
                                {'Add block'}
                            </Button>
                            {rootAddOpen && (
                                <AddBlockMenu
                                    addableTypes={ROOT_ADDABLE_TYPES}
                                    onPick={(type) => {
                                        onChangeBlocks([createDefaultBlock(type)]);
                                        setRootAddOpen(false);
                                    }}
                                    onClose={() => setRootAddOpen(false)}
                                />
                            )}
                        </div>
                    </div>
                ) : (
                    <ul className='MmBlocksHierarchyEditor__tree'>
                        {rootPaths.map((path, i) => {
                            const block = blocks[i];
                            if (!block) {
                                return null;
                            }
                            return (
                                <HierarchyNode
                                    key={pathKey(path)}
                                    root={blocks}
                                    block={block}
                                    path={path}
                                    depth={0}
                                    selectedPath={selectedPath}
                                    draggingPath={draggingPath}
                                    dragOverPath={dragOverPath}
                                    addMenu={addMenu}
                                    onSelectPath={onSelectPath}
                                    onOpenAddMenu={setAddMenu}
                                    onCloseAddMenu={onCloseAddMenu}
                                    onAddBlock={onAddBlock}
                                    onRemoveBlock={onRemoveBlock}
                                    onDragStart={setDraggingPath}
                                    onDragOver={setDragOverPath}
                                    onDragEnd={onDragEnd}
                                    onDrop={onDrop}
                                />
                            );
                        })}
                    </ul>
                )}
            </div>
            <div className='MmBlocksHierarchyEditor__propertiesPanel'>
                <h3 className='MmBlocksHierarchyEditor__heading'>{'Properties'}</h3>
                {!selectedBlock && (
                    <p className='MmBlocksHierarchyEditor__empty'>{'Select a block to edit its properties.'}</p>
                )}
                {selectedBlock && propertyFields.length === 0 && (
                    <p className='MmBlocksHierarchyEditor__empty'>
                        {`Block type "${selectedBlock.type}" has no editable scalar properties. Edit nested blocks in the hierarchy.`}
                    </p>
                )}
                {selectedBlock && propertyFields.length > 0 && (
                    <div className='MmBlocksHierarchyEditor__properties'>
                        {propertyFields.map((field) => (
                            <PropertyFieldEditor
                                key={field.key}
                                block={selectedBlock}
                                field={field}
                                onChange={onPropertyChange}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MmBlocksHierarchyEditor;
