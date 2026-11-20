// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {FormattedMessage, defineMessages, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {Checkbox} from '@mattermost/compass-ui/components/checkbox';
import {GenericModal} from '@mattermost/components';

import {openModal} from 'actions/views/modals';

import {ModalIdentifiers} from 'utils/constants';

import {resourceTypeLabels} from './attribute_details/attribute_applies_to_constants';
import type {ResourceObjectType} from './attribute_details/attribute_applies_to_constants';

import './global_attribute_duplicate_modal.scss';

type Props = {
    name: string;
    resourceTypes: ResourceObjectType[];
    onConfirm: (selected: ResourceObjectType[]) => void;
    onExited: () => void;
};

const noop = () => {};

/**
 * Asks which linked resource fields to recreate when duplicating a template
 * that already applies to one or more resources. Every resource starts checked.
 */
export const useGlobalAttributeDuplicatePrompt = () => {
    const dispatch = useDispatch();

    return (
        name: string,
        resourceTypes: ResourceObjectType[],
        onConfirm: (selected: ResourceObjectType[]) => void,
        onExited?: () => void,
    ) => {
        dispatch(openModal({
            modalId: ModalIdentifiers.GLOBAL_ATTRIBUTE_FIELD_DUPLICATE,
            dialogType: GlobalAttributeDuplicateModal,
            dialogProps: {
                name,
                resourceTypes,
                onConfirm,
                onExited,
            },
        }));
    };
};

function GlobalAttributeDuplicateModal({name, resourceTypes, onConfirm, onExited}: Props) {
    const {formatMessage} = useIntl();
    const [selected, setSelected] = useState<Record<ResourceObjectType, boolean>>(() => (
        Object.fromEntries(resourceTypes.map((type) => [type, true])) as Record<ResourceObjectType, boolean>
    ));

    const toggle = useCallback((type: ResourceObjectType, checked: boolean) => {
        setSelected((prev) => ({...prev, [type]: checked}));
    }, []);

    const handleConfirm = useCallback(() => {
        onConfirm(resourceTypes.filter((type) => selected[type]));
    }, [onConfirm, resourceTypes, selected]);

    const title = formatMessage(messages.title, {name});
    const confirmButtonText = formatMessage(messages.confirm);

    return (
        <GenericModal
            id='globalAttributeDuplicateModal'
            confirmButtonText={confirmButtonText}
            handleCancel={noop}
            handleConfirm={handleConfirm}
            modalHeaderText={title}
            onExited={onExited}
            compassDesign={true}
        >
            <p>
                <FormattedMessage {...messages.body}/>
            </p>
            <div
                className='GlobalAttributeDuplicateModal__resources'
                role='group'
                aria-label={formatMessage(messages.groupLabel)}
            >
                {resourceTypes.map((type) => (
                    <Checkbox
                        key={type}
                        checked={Boolean(selected[type])}
                        onChange={(event) => toggle(type, event.target.checked)}
                        data-testid={`global-attribute-duplicate-${type}`}
                    >
                        <FormattedMessage {...resourceTypeLabels[type]}/>
                    </Checkbox>
                ))}
            </div>
        </GenericModal>
    );
}

const messages = defineMessages({
    title: {
        id: 'admin.global_attributes.confirm.duplicate.title',
        defaultMessage: 'Duplicate {name}',
    },
    body: {
        id: 'admin.global_attributes.confirm.duplicate.body',
        defaultMessage: "Also copy this attribute's applications to:",
    },
    groupLabel: {
        id: 'admin.global_attributes.confirm.duplicate.group_label',
        defaultMessage: 'Resources to copy',
    },
    confirm: {
        id: 'admin.global_attributes.confirm.duplicate.button',
        defaultMessage: 'Duplicate',
    },
});

export default GlobalAttributeDuplicateModal;
