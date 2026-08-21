// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {defineMessages, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import type {PropertyFieldOption} from '@mattermost/types/properties';

import {openModal} from 'actions/views/modals';

import {ModalIdentifiers} from 'utils/constants';

import {
    findOrphansAfterDelete,
    getChildren,
    oxfordJoinNames,
    removeOption,
} from './graph_utils';

import './attribute_graph_delete_modal.scss';

export type GraphNodeDeleteViewModel =
    | {
        variant: 'blocked';
        optionName: string;
        orphans: string[];
        notAffected: Array<{name: string; remainingParents: string[]}>;
        firstOrphan: string;
    } |
    {
        variant: 'safe';
        optionName: string;
        descendantCount: number;
        accessRemoved: Array<{target: string; parentsThatLost: string[]}>;
        staysReachable: Array<{child: string; remainingParents: string[]}>;
    };

type Props = {
    optionName: string;
    options: PropertyFieldOption[];
    onConfirm: () => void;
    onExited: () => void;
};

// GenericModal only renders a Cancel button when handleCancel is supplied, and
// cancelling needs no side effect here beyond closing — same shape as
// global_attribute_delete_modal.
const noop = () => {};

function quotedOxfordJoin(names: string[]): string {
    return oxfordJoinNames(names.map((name) => `"${name}"`));
}

// G8 placeholder — replace if delete-safe spike disagrees
function reachableNames(options: PropertyFieldOption[], start: string): Set<string> {
    const children = new Map<string, string[]>();
    for (const option of options) {
        for (const parentName of option.parents ?? []) {
            const list = children.get(parentName);
            if (list) {
                list.push(option.name);
            } else {
                children.set(parentName, [option.name]);
            }
        }
    }
    const reached = new Set<string>();
    const pending = [start];
    while (pending.length > 0) {
        const node = pending.pop() as string;
        if (reached.has(node)) {
            continue;
        }
        reached.add(node);
        for (const child of children.get(node) ?? []) {
            pending.push(child);
        }
    }
    return reached;
}

// G8 placeholder — replace if delete-safe spike disagrees
function buildAccessRemovedLines(
    before: PropertyFieldOption[],
    after: PropertyFieldOption[],
): Array<{target: string; parentsThatLost: string[]}> {
    const lostByParent = new Map<string, Set<string>>();
    for (const option of after) {
        const lost = reachableNames(before, option.name);
        for (const name of reachableNames(after, option.name)) {
            lost.delete(name);
        }
        lost.delete(option.name);
        lostByParent.set(option.name, lost);
    }

    const lines: Array<{target: string; parentsThatLost: string[]}> = [];
    for (const target of before) {
        const parentsThatLost: string[] = [];
        for (const option of after) {
            if (lostByParent.get(option.name)?.has(target.name)) {
                parentsThatLost.push(option.name);
            }
        }
        if (parentsThatLost.length > 0) {
            lines.push({target: target.name, parentsThatLost});
        }
    }
    return lines;
}

// G8 placeholder — replace if delete-safe spike disagrees
function buildStaysReachableLines(
    directChildren: PropertyFieldOption[],
    after: PropertyFieldOption[],
    deletedName: string,
): Array<{child: string; remainingParents: string[]}> {
    const lines: Array<{child: string; remainingParents: string[]}> = [];
    for (const child of directChildren) {
        const afterChild = after.find((option) => option.name === child.name);
        const remainingParents = (afterChild?.parents ?? []).filter((parent) => parent !== deletedName);
        if (remainingParents.length === 0) {
            continue;
        }
        lines.push({child: child.name, remainingParents});
    }
    return lines;
}

export function buildGraphNodeDeleteViewModel(
    options: PropertyFieldOption[],
    optionName: string,
): GraphNodeDeleteViewModel | null {
    if (!options.some((option) => option.name === optionName)) {
        return null;
    }

    const orphans = findOrphansAfterDelete(options, optionName);
    const directChildren = getChildren(options, optionName);

    if (orphans.length > 0) {
        const orphanNames = new Set(orphans.map((orphan) => orphan.name));
        const notAffected = directChildren.
            filter((child) => !orphanNames.has(child.name)).
            map((child) => ({
                name: child.name,
                remainingParents: (child.parents ?? []).filter((parent) => parent !== optionName),
            }));
        return {
            variant: 'blocked',
            optionName,
            orphans: orphans.map((orphan) => orphan.name),
            notAffected,
            firstOrphan: orphans[0].name,
        };
    }

    const before = options;
    const after = removeOption(options, optionName);

    return {
        variant: 'safe',
        optionName,
        descendantCount: reachableNames(before, optionName).size - 1,
        accessRemoved: buildAccessRemovedLines(before, after),
        staysReachable: buildStaysReachableLines(directChildren, after, optionName),
    };
}

const messages = defineMessages({
    blockedTitle: {
        id: 'admin.global_attributes.attribute_details.graph.delete.blocked.title',
        defaultMessage: '{count, plural, one {Move one value first} other {Move {count} values first}}',
    },
    blockedLead: {
        id: 'admin.global_attributes.attribute_details.graph.delete.blocked.lead',
        defaultMessage: '{count, plural, one {Deleting "{name}" would leave {orphans} with no parent. Move it under something else first.} other {Deleting "{name}" would leave {orphans} with no parent. Move them under something else first.}}',
    },
    wouldBeLeftHeading: {
        id: 'admin.global_attributes.attribute_details.graph.delete.blocked.would_be_left',
        defaultMessage: 'Would be left with no parent',
    },
    onlyParent: {
        id: 'admin.global_attributes.attribute_details.graph.delete.blocked.only_parent',
        defaultMessage: '"{name}" is its only parent',
    },
    notAffectedHeading: {
        id: 'admin.global_attributes.attribute_details.graph.delete.blocked.not_affected',
        defaultMessage: 'Not affected',
    },
    notAffectedItem: {
        id: 'admin.global_attributes.attribute_details.graph.delete.blocked.not_affected.item',
        defaultMessage: '"{name}" is not affected — it also sits under {parents}.',
    },
    notAffectedHelper: {
        id: 'admin.global_attributes.attribute_details.graph.delete.blocked.not_affected.helper',
        defaultMessage: 'A value with another parent stays in the list, so it never blocks a delete.',
    },
    goToOrphan: {
        id: 'admin.global_attributes.attribute_details.graph.delete.blocked.go_to',
        defaultMessage: 'Go to "{name}"',
    },
    safeTitle: {
        id: 'admin.global_attributes.attribute_details.graph.delete.safe.title',
        defaultMessage: 'Delete "{name}"?',
    },
    safeSubtitle: {
        id: 'admin.global_attributes.attribute_details.graph.delete.safe.subtitle',
        defaultMessage: 'This removes access, not just a row',
    },
    safeLeadNone: {
        id: 'admin.global_attributes.attribute_details.graph.delete.safe.lead.none',
        defaultMessage: '"{name}" grants access to nothing else, so deleting it only removes the value itself.',
    },
    safeLeadSome: {
        id: 'admin.global_attributes.attribute_details.graph.delete.safe.lead.some',
        defaultMessage: '{count, plural, one {"{name}" grants access to 1 value. Deleting it removes those routes.} other {"{name}" grants access to {count} values. Deleting it removes those routes.}}',
    },
    accessRemovedHeading: {
        id: 'admin.global_attributes.attribute_details.graph.delete.safe.access_removed',
        defaultMessage: 'Access removed',
    },
    accessRemovedItem: {
        id: 'admin.global_attributes.attribute_details.graph.delete.safe.access_removed.item',
        defaultMessage: 'Holders of {parents} can no longer reach "{target}".',
    },
    staysReachableHeading: {
        id: 'admin.global_attributes.attribute_details.graph.delete.safe.stays_reachable',
        defaultMessage: 'Stays reachable',
    },
    staysReachableItem: {
        id: 'admin.global_attributes.attribute_details.graph.delete.safe.stays_reachable.item',
        defaultMessage: '"{child}" stays under {parents}.',
    },
    deleteValue: {
        id: 'admin.global_attributes.attribute_details.graph.delete.safe.confirm',
        defaultMessage: 'Delete the value',
    },
});

export function useGraphNodeDelete(
    options: PropertyFieldOption[],
    onOptionsChange: (options: PropertyFieldOption[]) => void,
    onGoToOrphan: (optionName: string) => void,
): (optionName: string) => void {
    const dispatch = useDispatch();

    return useCallback((optionName: string) => {
        const model = buildGraphNodeDeleteViewModel(options, optionName);
        if (!model) {
            return;
        }

        let pendingGoTo: string | null = null;

        dispatch(openModal({
            modalId: ModalIdentifiers.GRAPH_NODE_DELETE,
            dialogType: AttributeGraphDeleteModal,
            dialogProps: {
                optionName,
                options,
                onConfirm: () => {
                    if (model.variant === 'blocked') {
                        pendingGoTo = model.firstOrphan;
                        return;
                    }
                    onOptionsChange(removeOption(options, optionName));
                },
                onExited: () => {
                    if (pendingGoTo) {
                        onGoToOrphan(pendingGoTo);
                    }
                },
            },
        }));
    }, [dispatch, options, onOptionsChange, onGoToOrphan]);
}

function AttributeGraphDeleteModal({optionName, options, onConfirm, onExited}: Props) {
    const {formatMessage} = useIntl();
    const model = buildGraphNodeDeleteViewModel(options, optionName);
    if (!model) {
        return null;
    }

    switch (model.variant) {
    case 'blocked':
        return (
            <GenericModal
                compassDesign={true}
                modalHeaderText={formatMessage(messages.blockedTitle, {count: model.orphans.length})}
                confirmButtonText={formatMessage(messages.goToOrphan, {name: model.firstOrphan})}
                handleCancel={noop}
                handleConfirm={onConfirm}
                onExited={onExited}
                dataTestId='attributeGraphDeleteModal'
            >
                <div className='attribute-graph-delete-modal'>
                    <p>
                        {formatMessage(messages.blockedLead, {
                            count: model.orphans.length,
                            name: model.optionName,
                            orphans: quotedOxfordJoin(model.orphans),
                        })}
                    </p>
                    <p className='attribute-graph-delete-modal__heading'>
                        {formatMessage(messages.wouldBeLeftHeading)}
                    </p>
                    <ul className='attribute-graph-delete-modal__list'>
                        {model.orphans.map((orphanName) => (
                            <li
                                key={orphanName}
                                className='attribute-graph-delete-modal__item'
                            >
                                <span className='attribute-graph-delete-modal__item-name'>
                                    {orphanName}
                                </span>
                                <span className='attribute-graph-delete-modal__item-secondary'>
                                    {formatMessage(messages.onlyParent, {name: model.optionName})}
                                </span>
                            </li>
                        ))}
                    </ul>
                    {model.notAffected.length > 0 && (
                        <>
                            <p className='attribute-graph-delete-modal__heading'>
                                {formatMessage(messages.notAffectedHeading)}
                            </p>
                            <ul className='attribute-graph-delete-modal__list'>
                                {model.notAffected.map((item) => (
                                    <li
                                        key={item.name}
                                        className='attribute-graph-delete-modal__item'
                                    >
                                        {formatMessage(messages.notAffectedItem, {
                                            name: item.name,
                                            parents: quotedOxfordJoin(item.remainingParents),
                                        })}
                                    </li>
                                ))}
                            </ul>
                            <p className='attribute-graph-delete-modal__helper'>
                                {formatMessage(messages.notAffectedHelper)}
                            </p>
                        </>
                    )}
                </div>
            </GenericModal>
        );
    case 'safe':
        return (
            <GenericModal
                compassDesign={true}
                modalHeaderText={formatMessage(messages.safeTitle, {name: model.optionName})}
                modalSubheaderText={formatMessage(messages.safeSubtitle)}
                confirmButtonText={formatMessage(messages.deleteValue)}
                confirmButtonVariant='destructive'
                handleCancel={noop}
                handleConfirm={onConfirm}
                onExited={onExited}
                dataTestId='attributeGraphDeleteModal'
            >
                <div className='attribute-graph-delete-modal'>
                    <p>
                        {model.descendantCount === 0 ? formatMessage(messages.safeLeadNone, {name: model.optionName}) : formatMessage(messages.safeLeadSome, {
                            count: model.descendantCount,
                            name: model.optionName,
                        })}
                    </p>
                    {model.accessRemoved.length > 0 && (
                        <>
                            <p className='attribute-graph-delete-modal__heading'>
                                {formatMessage(messages.accessRemovedHeading)}
                            </p>
                            <ul className='attribute-graph-delete-modal__list'>
                                {model.accessRemoved.map((line) => (
                                    <li
                                        key={line.target}
                                        className='attribute-graph-delete-modal__item'
                                    >
                                        {formatMessage(messages.accessRemovedItem, {
                                            parents: quotedOxfordJoin(line.parentsThatLost),
                                            target: line.target,
                                        })}
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                    {model.staysReachable.length > 0 && (
                        <>
                            <p className='attribute-graph-delete-modal__heading'>
                                {formatMessage(messages.staysReachableHeading)}
                            </p>
                            <ul className='attribute-graph-delete-modal__list'>
                                {model.staysReachable.map((line) => (
                                    <li
                                        key={line.child}
                                        className='attribute-graph-delete-modal__item'
                                    >
                                        {formatMessage(messages.staysReachableItem, {
                                            child: line.child,
                                            parents: quotedOxfordJoin(line.remainingParents),
                                        })}
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </div>
            </GenericModal>
        );
    default: {
        const exhaustiveCheck: never = model;
        return exhaustiveCheck;
    }
    }
}

export default AttributeGraphDeleteModal;
