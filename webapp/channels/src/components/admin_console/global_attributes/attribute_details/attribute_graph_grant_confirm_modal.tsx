// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {LinkVariantIcon} from '@mattermost/compass-icons/components';
import {GenericModal} from '@mattermost/components';

import {openModal} from 'actions/views/modals';

import {ModalIdentifiers} from 'utils/constants';

import {oxfordJoinNames} from './graph_utils';

import './attribute_graph_grant_confirm_modal.scss';

export type GrantConfirmRequest = {
    parentName: string;
    childName: string;
    newlyReachable: string[];
    ancestorsOfParent: string[];
};

type Props = {
    parentName: string;
    childName: string;
    newlyReachable: string[];
    ancestorsOfParent: string[];
    onConfirm: () => void;
    onCancel: () => void;
    onExited: () => void;
};

export function useGrantConfirm(): (req: GrantConfirmRequest) => Promise<boolean> {
    const dispatch = useDispatch();

    return (req: GrantConfirmRequest) => {
        if (req.newlyReachable.length === 0) {
            // Callers must not open. Defensive: empty list means apply without a modal.
            return Promise.resolve(true);
        }

        return new Promise<boolean>((resolve) => {
            let settled = false;
            const settle = (value: boolean) => {
                if (!settled) {
                    settled = true;
                    resolve(value);
                }
            };

            dispatch(openModal({
                modalId: ModalIdentifiers.GRAPH_GRANT_CONFIRM,
                dialogType: AttributeGraphGrantConfirmModal,
                dialogProps: {
                    parentName: req.parentName,
                    childName: req.childName,
                    newlyReachable: req.newlyReachable,
                    ancestorsOfParent: req.ancestorsOfParent,
                    onConfirm: () => settle(true),
                    onCancel: () => settle(false),
                    onExited: () => settle(false),
                },
            }));
        });
    };
}

function AttributeGraphGrantConfirmModal({
    parentName,
    childName,
    newlyReachable,
    ancestorsOfParent,
    onConfirm,
    onCancel,
    onExited,
}: Props) {
    const {formatMessage} = useIntl();
    const showAncestors = ancestorsOfParent.length > 0;
    const ancestors = oxfordJoinNames(ancestorsOfParent.map((name) => `"${name}"`));

    return (
        <GenericModal
            id='attributeGraphGrantConfirmModal'
            className='attribute-graph-grant-confirm-modal'
            compassDesign={true}
            modalHeaderText={formatMessage(messages.title)}
            modalSubheaderText={formatMessage(messages.subtitle, {parent: parentName, child: childName})}
            confirmButtonText={formatMessage(messages.confirm)}
            handleConfirm={onConfirm}
            handleCancel={onCancel}
            onExited={onExited}
            dataTestId='attributeGraphGrantConfirmModal'
        >
            <p className='attribute-graph-grant-confirm-modal__lead'>
                <FormattedMessage
                    {...messages.lead}
                    values={{parent: parentName, child: childName}}
                />
            </p>
            <div className='attribute-graph-grant-confirm-modal__grant'>
                <span
                    className='attribute-graph-grant-confirm-modal__grant-icon'
                    aria-hidden={true}
                >
                    <LinkVariantIcon size={16}/>
                </span>
                <span>
                    <FormattedMessage
                        {...messages.grant}
                        values={{parent: parentName, child: childName}}
                    />
                </span>
            </div>
            <div className='attribute-graph-grant-confirm-modal__section'>
                <p className='attribute-graph-grant-confirm-modal__section-title'>
                    <FormattedMessage
                        {...messages.newlyReachable}
                        values={{count: newlyReachable.length}}
                    />
                </p>
                <ul
                    className='attribute-graph-grant-confirm-modal__list'
                    data-testid='attributeGraphGrantConfirm__newlyReachable'
                >
                    {newlyReachable.map((name) => (
                        <li
                            key={name}
                            className='attribute-graph-grant-confirm-modal__item'
                        >
                            {name}
                        </li>
                    ))}
                </ul>
            </div>
            {showAncestors && (
                <p
                    className='attribute-graph-grant-confirm-modal__hint'
                    data-testid='attributeGraphGrantConfirm__ancestorHint'
                >
                    <FormattedMessage
                        {...messages.ancestorHint}
                        values={{parent: parentName, ancestors}}
                    />
                </p>
            )}
        </GenericModal>
    );
}

export default AttributeGraphGrantConfirmModal;

const messages = defineMessages({
    title: {
        id: 'admin.global_attributes.attribute_details.graph.grant_confirm.title',
        defaultMessage: 'Confirm this grant',
    },
    subtitle: {
        id: 'admin.global_attributes.attribute_details.graph.grant_confirm.subtitle',
        defaultMessage: '{parent} → {child}',
    },
    lead: {
        id: 'admin.global_attributes.attribute_details.graph.grant_confirm.lead',
        defaultMessage: 'Adding this means everyone who holds "{parent}" can reach every channel marked "{child}".',
    },
    grant: {
        id: 'admin.global_attributes.attribute_details.graph.grant_confirm.grant',
        defaultMessage: 'Anyone holding "{parent}" also gets "{child}".',
    },
    newlyReachable: {
        id: 'admin.global_attributes.attribute_details.graph.grant_confirm.newly_reachable',
        defaultMessage: '{count, plural, one {1 value becomes newly reachable} other {{count} values become newly reachable}}',
    },
    ancestorHint: {
        id: 'admin.global_attributes.attribute_details.graph.grant_confirm.ancestor_hint',
        defaultMessage: 'Everything above "{parent}" inherits the same reach: {ancestors}.',
    },
    confirm: {
        id: 'admin.global_attributes.attribute_details.graph.grant_confirm.confirm',
        defaultMessage: 'Add the parent',
    },
});
