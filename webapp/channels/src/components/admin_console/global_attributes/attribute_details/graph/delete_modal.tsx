// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import type {PropertyFieldOption} from '@mattermost/types/properties';

import {openModal} from 'actions/views/modals';

import {ModalIdentifiers} from 'utils/constants';

import {oxfordJoinNames} from 'components/property_fields/graph';

import {
    findOrphansAfterDelete,
    getChildren,
    removeOption,
} from './graph_utils';

import './delete_modal.scss';

export type GraphNodeDeleteViewModel =
    | {variant: 'direct'; optionName: string} |
    {variant: 'blocked'; optionName: string; orphanCount: number; firstOrphan: string} |
    {variant: 'safe'; optionName: string; survivingChildren: string[]};

type Props = {
    optionName: string;
    options: PropertyFieldOption[];
    onConfirm: () => void;
    onExited: () => void;
};

// GenericModal only shows Cancel when handleCancel is set.
const noop = () => {};

export function buildGraphNodeDeleteViewModel(
    options: PropertyFieldOption[],
    optionName: string,
): GraphNodeDeleteViewModel | null {
    if (!options.some((option) => option.name === optionName)) {
        return null;
    }

    const orphans = findOrphansAfterDelete(options, optionName);
    if (orphans.length > 0) {
        return {
            variant: 'blocked',
            optionName,
            orphanCount: orphans.length,
            firstOrphan: orphans[0].name,
        };
    }

    const directChildren = getChildren(options, optionName);
    if (directChildren.length > 0) {
        return {
            variant: 'safe',
            optionName,
            survivingChildren: directChildren.map((child) => child.name),
        };
    }

    return {variant: 'direct', optionName};
}

const messages = defineMessages({
    blockedTitle: {
        id: 'admin.global_attributes.attribute_details.graph.delete.blocked.title',
        defaultMessage: "Can't delete {name}",
    },
    blockedLead: {
        id: 'admin.global_attributes.attribute_details.graph.delete.blocked.lead',
        defaultMessage: "{count, plural, one {Child values need a parent. {name} is the only parent of 1 child value, so it can't be deleted until that child is moved or deleted.} other {Child values need a parent. {name} is the only parent of {count} child values, so it can't be deleted until those children are moved or deleted.}}",
    },
    goToOrphan: {
        id: 'admin.global_attributes.attribute_details.graph.delete.blocked.go_to',
        defaultMessage: 'Go to {name}',
    },
    safeTitle: {
        id: 'admin.global_attributes.attribute_details.graph.delete.safe.title',
        defaultMessage: 'Delete {name}?',
    },
    safeLead: {
        id: 'admin.global_attributes.attribute_details.graph.delete.safe.lead',
        defaultMessage: '{count, plural, one {1 child ({children}) of this value has other parent values, so it will not be removed. Are you sure you want to delete {name}?} other {{count} children ({children}) of this value have other parent values, so they will not be removed. Are you sure you want to delete {name}?}}',
    },
    deleteValue: {
        id: 'admin.global_attributes.attribute_details.graph.delete.safe.confirm',
        defaultMessage: 'Delete',
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

        if (model.variant === 'direct') {
            onOptionsChange(removeOption(options, optionName));
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
    case 'direct':
        return null;
    case 'blocked':
        return (
            <GenericModal
                compassDesign={true}
                modalHeaderText={formatMessage(messages.blockedTitle, {name: model.optionName})}
                confirmButtonText={formatMessage(messages.goToOrphan, {name: model.firstOrphan})}
                handleCancel={noop}
                handleConfirm={onConfirm}
                onExited={onExited}
                dataTestId='attributeGraphDeleteModal'
            >
                <div className='attribute-graph-delete-modal'>
                    <p>
                        <FormattedMessage
                            {...messages.blockedLead}
                            values={{
                                count: model.orphanCount,
                                name: <strong>{model.optionName}</strong>,
                            }}
                        />
                    </p>
                </div>
            </GenericModal>
        );
    case 'safe':
        return (
            <GenericModal
                compassDesign={true}
                modalHeaderText={formatMessage(messages.safeTitle, {name: model.optionName})}
                confirmButtonText={formatMessage(messages.deleteValue)}
                confirmButtonVariant='destructive'
                handleCancel={noop}
                handleConfirm={onConfirm}
                onExited={onExited}
                dataTestId='attributeGraphDeleteModal'
            >
                <div className='attribute-graph-delete-modal'>
                    <p>
                        <FormattedMessage
                            {...messages.safeLead}
                            values={{
                                count: model.survivingChildren.length,
                                children: oxfordJoinNames(model.survivingChildren),
                                name: <strong>{model.optionName}</strong>,
                            }}
                        />
                    </p>
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
