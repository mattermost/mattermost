// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef} from 'react';
import type {JSX} from 'react';
import {FormattedMessage, defineMessages, useIntl} from 'react-intl';

import {ChevronDownIcon} from '@mattermost/compass-icons/components';
import {Button, buttonClassNames} from '@mattermost/shared/components/button';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import * as Menu from 'components/menu';
import {UserAttributeFields} from 'components/property_fields/user_attribute_fields';
import type {UserAttributeValue} from 'components/property_fields/user_attribute_fields';

import {getUserPropertyFieldLabel} from 'utils/properties';

import {getAddableFields, getRowFields, isRowRemovable} from './bot_attributes';
import type {BotAttributesState} from './bot_attributes';

import './bot_attributes_section.scss';

export const BOT_ATTRIBUTES_ADD_BUTTON_ID = 'botAttributesAddButton';
export const MANAGE_ATTRIBUTES_PATH = '/admin_console/system_attributes/manage_attributes';

const messages = defineMessages({
    add: {
        id: 'bots.attributes.add',
        defaultMessage: 'Add attribute',
    },
});

export type BotAttributesSectionProps = {
    fields: UserPropertyField[];
    state: BotAttributesState;
    disabled: boolean;
    canEditAdminManaged: boolean;
    onAdd: (fieldId: string) => void;
    onRemove: (fieldId: string) => void;
    onChange: (fieldId: string, value: UserAttributeValue) => void;
    onRetry: () => void;
};

const focusAddTrigger = () => document.getElementById(BOT_ATTRIBUTES_ADD_BUTTON_ID)?.focus();

export default function BotAttributesSection({
    fields,
    state: {status, rows, values, initialValues, errors},
    disabled,
    canEditAdminManaged,
    onAdd,
    onRemove,
    onChange,
    onRetry,
}: BotAttributesSectionProps): JSX.Element {
    const {formatMessage} = useIntl();

    const rowFields = getRowFields(fields, rows);
    const addableFields = getAddableFields(fields, rows, {canEditAdminManaged});

    const formattedErrors: Record<string, string | undefined> = {};
    for (const [id, descriptor] of Object.entries(errors)) {
        formattedErrors[id] = descriptor ? formatMessage(descriptor) : undefined;
    }

    const retryButtonRef = useRef<HTMLButtonElement>(null);
    const retrying = useRef(false);

    useEffect(() => {
        if (!retrying.current || status === 'loading') {
            return;
        }
        retrying.current = false;
        if (status === 'ready') {
            focusAddTrigger();
        } else {
            retryButtonRef.current?.focus();
        }
    }, [status]);

    const handleRetry = () => {
        retrying.current = true;
        onRetry();
    };

    const handleRemove = (fieldId: string) => {
        onRemove(fieldId);
        focusAddTrigger();
    };

    const renderAddMenu = (triggerDisabled: boolean) => (
        <div>
            <Menu.Container
                menuButton={{
                    id: BOT_ATTRIBUTES_ADD_BUTTON_ID,
                    dataTestId: BOT_ATTRIBUTES_ADD_BUTTON_ID,
                    class: buttonClassNames({emphasis: 'tertiary', size: 'sm'}, 'BotAttributesSection__add'),
                    disabled: triggerDisabled,
                    children: (
                        <>
                            <FormattedMessage {...messages.add}/>
                            <ChevronDownIcon size={16}/>
                        </>
                    ),
                }}
                menu={{
                    id: 'botAttributesAddMenu',
                    'aria-label': formatMessage(messages.add),
                }}
            >
                {addableFields.length > 0 ? addableFields.map((field) => (
                    <Menu.Item
                        key={field.id}
                        id={`botAttributesAdd-${field.id}`}
                        data-testid={`botAttributesAdd-${field.id}`}
                        onClick={() => onAdd(field.id)}
                        labels={<span>{getUserPropertyFieldLabel(field)}</span>}
                    />
                )) : (
                    <Menu.Item
                        id='botAttributesNoneAvailable'
                        data-testid='botAttributesNoneAvailable'
                        disabled={true}
                        labels={
                            <FormattedMessage
                                id='bots.attributes.none_available'
                                defaultMessage='No attributes available'
                            />
                        }
                    />
                )}
                {canEditAdminManaged && <Menu.Separator/>}
                {canEditAdminManaged && (
                    <Menu.LinkItem
                        id='botAttributesManage'
                        data-testid='botAttributesManage'
                        to={MANAGE_ATTRIBUTES_PATH}
                        labels={
                            <FormattedMessage
                                id='bots.attributes.manage'
                                defaultMessage='Manage attributes'
                            />
                        }
                    />
                )}
            </Menu.Container>
        </div>
    );

    let body: React.ReactNode;
    switch (status) {
    case 'loading':
        body = renderAddMenu(true);
        break;
    case 'error':
        body = (
            <div
                className='BotAttributesSection__error'
                data-testid='botAttributesLoadError'
            >
                <span role='alert'>
                    <FormattedMessage
                        id='bots.attributes.load_failed'
                        defaultMessage='Attributes could not be loaded.'
                    />
                </span>
                <Button
                    type='button'
                    emphasis='tertiary'
                    size='sm'
                    ref={retryButtonRef}
                    data-testid='botAttributesRetry'
                    onClick={handleRetry}
                >
                    <FormattedMessage
                        id='bots.attributes.retry'
                        defaultMessage='Try again'
                    />
                </Button>
            </div>
        );
        break;
    case 'ready':
        body = (
            <>
                {rowFields.length > 0 && (
                    <UserAttributeFields
                        fields={rowFields}
                        values={values}
                        errors={formattedErrors}
                        onChange={onChange}
                        disabled={disabled}
                        canEditAdminManaged={canEditAdminManaged}
                        onRemove={handleRemove}
                        isRemovable={(field) => isRowRemovable(field, initialValues)}
                        testIdPrefix='bot-attribute'
                    />
                )}
                {renderAddMenu(disabled)}
            </>
        );
        break;
    default: {
        const unhandled: never = status;
        return unhandled;
    }
    }

    return (
        <div
            className='form-group BotAttributesSection'
            role='group'
            aria-labelledby='botAttributesTitle'
            data-testid='botAttributesSection'
        >
            <span
                id='botAttributesTitle'
                className='control-label col-sm-4 BotAttributesSection__title'
            >
                <FormattedMessage
                    id='bots.attributes.title'
                    defaultMessage='Attributes'
                />
            </span>
            <div className='col-md-5 col-sm-8'>
                <div className='BotAttributesSection__description'>
                    <FormattedMessage
                        id='bots.attributes.description'
                        defaultMessage='Configure attributes and values for this bot'
                    />
                </div>
                {body}
            </div>
        </div>
    );
}
