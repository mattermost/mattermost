// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {AlertCircleOutlineIcon, CancelIcon, CheckIcon, CheckCircleOutlineIcon, ChevronRightIcon, DotsVerticalIcon, UpdateIcon} from '@mattermost/compass-icons/components';

import {openModal} from 'actions/views/modals';

import * as Menu from 'components/menu';

import {ModalIdentifiers} from 'utils/constants';

import DisableAttributeModal from './disable_attribute_modal';
import type {StagedAttrs} from './use_session_attribute_edits';
import {DURATION_PRESETS_SECONDS, formatDuration, getSessionAttrs, getSessionDisplayName} from './utils';
import type {SessionAttributeField} from './utils';

type Props = {
    field: SessionAttributeField;
    onStageChange: (fieldId: string, partial: StagedAttrs) => void;
    disabled?: boolean;
};

export default function SessionAttributesDotMenu({field, onStageChange, disabled = false}: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const attrs = getSessionAttrs(field);
    const menuId = `session-attribute-dotmenu-${field.id}`;

    const handleTtlChange = useCallback((seconds: number) => {
        onStageChange(field.id, {ttl_seconds: seconds});
    }, [field.id, onStageChange]);

    const openDisableModal = () => {
        dispatch(openModal({
            modalId: ModalIdentifiers.SESSION_ATTRIBUTE_DISABLE,
            dialogType: DisableAttributeModal,
            dialogProps: {
                attributeName: getSessionDisplayName(field),
                onConfirm: () => onStageChange(field.id, {enabled: false}),
                onExited: () => {},
            },
        }));
    };

    const renderPresets = (current: number, testIdPrefix: string, apply: (seconds: number) => void) => DURATION_PRESETS_SECONDS.map((seconds) => (
        <Menu.Item
            key={seconds}
            id={`${testIdPrefix}-${seconds}`}
            data-testid={`${testIdPrefix}-${seconds}`}
            role='menuitemradio'
            forceCloseOnSelect={true}
            aria-checked={current === seconds}
            onClick={() => apply(seconds)}
            labels={<span>{formatDuration(seconds)}</span>}
            trailingElements={current === seconds ? (
                <CheckIcon
                    size={16}
                    className='SessionAttributes__menu-check'
                />
            ) : undefined}
        />
    ));

    return (
        <Menu.Container
            menuButton={{
                id: menuId,
                class: 'btn btn-transparent',
                children: <DotsVerticalIcon size={18}/>,
                dataTestId: menuId,
                disabled,
            }}
            menu={{
                id: `${menuId}-menu`,
                'aria-label': formatMessage({id: 'admin.session_attributes.dotmenu.menu.aria_label', defaultMessage: 'Select an action'}),
            }}
        >
            <Menu.SubMenu
                id={`${menuId}-ttl`}
                menuId={`${menuId}-ttl-menu`}
                leadingElement={<UpdateIcon size={18}/>}
                labels={(
                    <FormattedMessage
                        id='admin.session_attributes.dotmenu.ttl.label'
                        defaultMessage='Time-to-live (TTL)'
                    />
                )}
                trailingElements={(
                    <>
                        {formatDuration(attrs.ttl_seconds)}
                        <ChevronRightIcon size={16}/>
                    </>
                )}
            >
                {renderPresets(attrs.ttl_seconds, `session-attribute-ttl-option-${field.id}`, handleTtlChange)}
            </Menu.SubMenu>
            <Menu.SubMenu
                id={`${menuId}-grace`}
                menuId={`${menuId}-grace-menu`}
                leadingElement={<AlertCircleOutlineIcon size={18}/>}
                labels={(
                    <FormattedMessage
                        id='admin.session_attributes.dotmenu.grace.label'
                        defaultMessage='Grace Period'
                    />
                )}
                trailingElements={(
                    <>
                        {formatDuration(attrs.grace_period_seconds)}
                        <ChevronRightIcon size={16}/>
                    </>
                )}
            >
                {renderPresets(attrs.grace_period_seconds, `session-attribute-grace-option-${field.id}`, (seconds) => onStageChange(field.id, {grace_period_seconds: seconds}))}
            </Menu.SubMenu>
            <Menu.Separator/>
            {attrs.enabled ? (
                <Menu.Item
                    id={`session-attribute-disable-${field.id}`}
                    data-testid={`session-attribute-disable-${field.id}`}
                    isDestructive={true}
                    leadingElement={<CancelIcon size={18}/>}
                    onClick={openDisableModal}
                    labels={(
                        <FormattedMessage
                            id='admin.session_attributes.dotmenu.disable.label'
                            defaultMessage='Disable'
                        />
                    )}
                />
            ) : (
                <Menu.Item
                    id={`session-attribute-enable-${field.id}`}
                    data-testid={`session-attribute-enable-${field.id}`}
                    leadingElement={<CheckCircleOutlineIcon size={18}/>}
                    onClick={() => onStageChange(field.id, {enabled: true})}
                    labels={(
                        <FormattedMessage
                            id='admin.session_attributes.dotmenu.enable.label'
                            defaultMessage='Enable'
                        />
                    )}
                />
            )}
        </Menu.Container>
    );
}
