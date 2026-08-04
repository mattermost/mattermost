// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createColumnHelper, getCoreRowModel, useReactTable, type ColumnDef} from '@tanstack/react-table';
import type {ComponentType} from 'react';
import React, {useEffect, useMemo, useState} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage, defineMessages, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {ChevronDownCircleOutlineIcon, ContentCopyIcon, DotsHorizontalIcon, FormatListBulletedIcon, MenuVariantIcon, PencilOutlineIcon, PowerPlugOutlineIcon, SortAscendingIcon, SyncIcon, TrashCanOutlineIcon} from '@mattermost/compass-icons/components';
import type IconProps from '@mattermost/compass-icons/components/props';
import type {FieldType, PropertyField, PropertyFieldOption} from '@mattermost/types/properties';
import {supportsOptions} from '@mattermost/types/properties';

import {fetchPropertyFields} from 'mattermost-redux/actions/properties';
import {getPropertyFieldsForObjectTypeAndGroup, getPropertyGroupByName} from 'mattermost-redux/selectors/entities/properties';

import {getPluginDisplayName} from 'selectors/plugins';

import LoadingScreen from 'components/loading_screen';
import * as Menu from 'components/menu';

import type {GlobalState} from 'types/store';

import {AdminConsoleListTable} from '../list_table';

import './global_attributes_table.scss';

const GLOBAL_ATTRIBUTES_GROUP_NAME = 'access_control';
const GLOBAL_ATTRIBUTES_OBJECT_TYPE = 'template';
const GLOBAL_ATTRIBUTES_TARGET_TYPE = 'system';

const columnHelper = createColumnHelper<PropertyField>();

// Same set as the User Attributes page's type selector (user_properties_type_menu.tsx).
const TYPE_ICONS: Partial<Record<FieldType, ComponentType<IconProps>>> = {
    text: MenuVariantIcon,
    select: ChevronDownCircleOutlineIcon,
    multiselect: FormatListBulletedIcon,
    rank: SortAscendingIcon,
};

export function getTypeIcon(fieldType: FieldType): ComponentType<IconProps> {
    return TYPE_ICONS[fieldType] ?? MenuVariantIcon;
}

export function getDisplayName(field: PropertyField): string {
    return (field.attrs?.display_name as string | undefined) || field.name;
}

function getTypeLabel(fieldType: FieldType): MessageDescriptor {
    return (typeLabels as Partial<Record<FieldType, MessageDescriptor>>)[fieldType] ?? typeLabels.fallback;
}

type SourceKind = 'plugin' | 'ldap' | 'saml' | 'managed';

export function getSourceKind(field: PropertyField): SourceKind {
    const attrs = field.attrs ?? {};
    if (attrs.source_plugin_id && attrs.protected) {
        return 'plugin';
    }
    if (attrs.ldap) {
        return 'ldap';
    }
    if (attrs.saml) {
        return 'saml';
    }
    return 'managed';
}

const SOURCE_ICONS: Partial<Record<SourceKind, ComponentType<IconProps>>> = {
    plugin: PowerPlugOutlineIcon,
    ldap: SyncIcon,
    saml: SyncIcon,
};

export function getSourceIcon(kind: SourceKind): ComponentType<IconProps> | undefined {
    return SOURCE_ICONS[kind];
}

function SourceCell({field}: {field: PropertyField}) {
    const kind = getSourceKind(field);
    const pluginId = field.attrs?.source_plugin_id as string | undefined;
    const pluginDisplayName = useSelector((state: GlobalState) => getPluginDisplayName(state, pluginId));

    let content: React.ReactNode;
    if (kind === 'plugin') {
        content = pluginDisplayName;
    } else if (kind === 'ldap') {
        content = <FormattedMessage {...sourceLabels.ldap}/>;
    } else if (kind === 'saml') {
        content = <FormattedMessage {...sourceLabels.saml}/>;
    } else {
        content = <FormattedMessage {...sourceLabels.managed}/>;
    }

    const Icon = getSourceIcon(kind);

    return (
        <span
            className='GlobalAttributesTable__source'
            data-testid='global-attribute-source'
        >
            {Icon && <Icon size={16}/>}
            {content}
        </span>
    );
}

function OptionsCell({field}: {field: PropertyField}) {
    if (!supportsOptions(field)) {
        return <FormattedMessage {...optionsLabels.freeText}/>;
    }

    const count = (field.attrs?.options as PropertyFieldOption[] | undefined)?.length ?? 0;

    return (
        <FormattedMessage
            {...optionsLabels.count}
            values={{count}}
        />
    );
}

function ActionsCell({field}: {field: PropertyField}) {
    const {formatMessage} = useIntl();
    const menuId = `global-attribute-actions-${field.id}`;

    return (
        <Menu.Container
            menuButton={{
                id: `${menuId}-button`,
                class: 'btn btn-transparent GlobalAttributesTable__actionsButton',
                children: <DotsHorizontalIcon size={18}/>,
                dataTestId: menuId,
                'aria-label': formatMessage(actionsLabels.tooltip),
            }}
            menuButtonTooltip={{text: formatMessage(actionsLabels.tooltip)}}
            menu={{
                id: `${menuId}-menu`,
                'aria-label': formatMessage(actionsLabels.menuLabel),
            }}
            anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
            transformOrigin={{vertical: 'top', horizontal: 'right'}}
        >
            <Menu.Item
                id={`${menuId}-edit`}
                disabled={true}
                leadingElement={<PencilOutlineIcon size={18}/>}
                labels={(
                    <>
                        <span><FormattedMessage {...actionsLabels.edit}/></span>
                        <span><FormattedMessage {...actionsLabels.comingSoon}/></span>
                    </>
                )}
            />
            <Menu.Item
                id={`${menuId}-duplicate`}
                disabled={true}
                leadingElement={<ContentCopyIcon size={18}/>}
                labels={(
                    <>
                        <span><FormattedMessage {...actionsLabels.duplicate}/></span>
                        <span><FormattedMessage {...actionsLabels.comingSoon}/></span>
                    </>
                )}
            />
            <Menu.Item
                id={`${menuId}-delete`}
                disabled={true}
                isDestructive={true}
                leadingElement={<TrashCanOutlineIcon size={18}/>}
                labels={(
                    <>
                        <span><FormattedMessage {...actionsLabels.delete}/></span>
                        <span><FormattedMessage {...actionsLabels.comingSoon}/></span>
                    </>
                )}
            />
        </Menu.Container>
    );
}

export default function GlobalAttributesTable() {
    const dispatch = useDispatch();

    const [loaded, setLoaded] = useState(false);
    const [loadError, setLoadError] = useState(false);

    const groupId = useSelector((state: GlobalState) =>
        getPropertyGroupByName(state, GLOBAL_ATTRIBUTES_GROUP_NAME)?.id ?? '',
    );

    const fields = useSelector((state: GlobalState) =>
        getPropertyFieldsForObjectTypeAndGroup(state, GLOBAL_ATTRIBUTES_OBJECT_TYPE, groupId),
    );

    useEffect(() => {
        let active = true;

        const load = async () => {
            try {
                await dispatch(fetchPropertyFields(GLOBAL_ATTRIBUTES_GROUP_NAME, GLOBAL_ATTRIBUTES_OBJECT_TYPE, GLOBAL_ATTRIBUTES_TARGET_TYPE));
                if (active) {
                    setLoadError(false);
                }
            } catch (error) {
                // Surface an error state instead of a misleading empty state.
                console.error('GlobalAttributesTable-load: ', error); // eslint-disable-line no-console
                if (active) {
                    setLoadError(true);
                }
            } finally {
                if (active) {
                    setLoaded(true);
                }
            }
        };

        load();

        return () => {
            active = false;
        };
    }, [dispatch]);

    const rows = useMemo(
        () => [...fields].sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b))),
        [fields],
    );

    const columns = useMemo<Array<ColumnDef<PropertyField, any>>>(() => {
        return [
            columnHelper.accessor((row) => getDisplayName(row), {
                id: 'attribute',
                header: () => <FormattedMessage {...messages.attribute}/>,
                cell: ({getValue}) => (
                    <span
                        className='GlobalAttributesTable__name'
                        data-testid='global-attribute-name'
                    >
                        {getValue()}
                    </span>
                ),
                enableSorting: false,
                enableHiding: false,
            }),
            columnHelper.accessor('type', {
                id: 'type',
                header: () => <FormattedMessage {...messages.type}/>,
                cell: ({getValue}) => {
                    const fieldType = getValue();
                    const Icon = getTypeIcon(fieldType);

                    return (
                        <span
                            className='GlobalAttributesTable__type'
                            data-testid='global-attribute-type'
                        >
                            <Icon size={16}/>
                            <FormattedMessage {...getTypeLabel(fieldType)}/>
                        </span>
                    );
                },
                enableSorting: false,
                enableHiding: false,
            }),
            columnHelper.display({
                id: 'applies_to',
                header: () => <FormattedMessage {...messages.appliesTo}/>,
                cell: () => <span data-testid='global-attribute-applies-to'>{'—'}</span>,
                enableHiding: false,
            }),
            columnHelper.display({
                id: 'source',
                header: () => <FormattedMessage {...messages.source}/>,
                cell: ({row}) => <SourceCell field={row.original}/>,
                enableHiding: false,
            }),
            columnHelper.display({
                id: 'options',
                header: () => <FormattedMessage {...messages.options}/>,
                cell: ({row}) => (
                    <span data-testid='global-attribute-options'>
                        <OptionsCell field={row.original}/>
                    </span>
                ),
                enableHiding: false,
            }),
            columnHelper.display({
                id: 'actions',
                cell: ({row}) => <ActionsCell field={row.original}/>,
                enableHiding: false,
            }),
        ];
    }, []);

    const table = useReactTable<PropertyField>({
        data: rows,
        columns,
        getCoreRowModel: getCoreRowModel<PropertyField>(),
        enableSortingRemoval: false,
        enableMultiSort: false,
        renderFallbackValue: '',
        meta: {tableId: 'globalAttributes', disablePaginationControls: true},
        manualPagination: true,
        enableColumnPinning: false,
    });

    if (!loaded) {
        return <LoadingScreen/>;
    }

    if (loadError) {
        return (
            <div
                className='GlobalAttributesTable__empty'
                data-testid='global-attributes-error'
            >
                <FormattedMessage {...messages.loadError}/>
            </div>
        );
    }

    if (rows.length === 0) {
        return (
            <div
                className='GlobalAttributesTable__empty'
                data-testid='global-attributes-empty'
            >
                <FormattedMessage {...messages.empty}/>
            </div>
        );
    }

    return (
        <div className='GlobalAttributesTable__wrapper'>
            <AdminConsoleListTable<PropertyField> table={table}/>
        </div>
    );
}

const messages = defineMessages({
    attribute: {id: 'admin.global_attributes.table.attribute', defaultMessage: 'Attribute'},
    type: {id: 'admin.global_attributes.table.type', defaultMessage: 'Type'},
    appliesTo: {id: 'admin.global_attributes.table.applies_to', defaultMessage: 'Applies to'},
    source: {id: 'admin.global_attributes.table.source', defaultMessage: 'Source'},
    options: {id: 'admin.global_attributes.table.options', defaultMessage: 'Options'},
    empty: {
        id: 'admin.global_attributes.table.empty',
        defaultMessage: 'No attributes yet. Attributes are currently managed elsewhere; creating them from this page is coming soon.',
    },
    loadError: {id: 'admin.global_attributes.table.load_error', defaultMessage: 'There was an error while loading attributes.'},
});

const typeLabels = defineMessages({
    text: {id: 'admin.global_attributes.table.type.text', defaultMessage: 'Text'},
    select: {id: 'admin.global_attributes.table.type.select', defaultMessage: 'Select'},
    multiselect: {id: 'admin.global_attributes.table.type.multiselect', defaultMessage: 'Multiselect'},
    rank: {id: 'admin.global_attributes.table.type.rank', defaultMessage: 'Ranked'},
    fallback: {id: 'admin.global_attributes.table.type.fallback', defaultMessage: 'Other'},
});

const sourceLabels = defineMessages({
    ldap: {id: 'admin.global_attributes.table.source.ldap', defaultMessage: 'AD/LDAP'},
    saml: {id: 'admin.global_attributes.table.source.saml', defaultMessage: 'SAML'},
    managed: {id: 'admin.global_attributes.table.source.managed', defaultMessage: 'Managed here'},
});

const optionsLabels = defineMessages({
    freeText: {id: 'admin.global_attributes.table.options.free_text', defaultMessage: 'Free Text'},
    count: {id: 'admin.global_attributes.table.options.count', defaultMessage: '{count, plural, one {# option} other {# options}}'},
});

const actionsLabels = defineMessages({
    tooltip: {id: 'admin.global_attributes.table.actions.tooltip', defaultMessage: 'More actions'},
    menuLabel: {id: 'admin.global_attributes.table.actions.menu_label', defaultMessage: 'Select an action'},
    edit: {id: 'admin.global_attributes.table.actions.edit', defaultMessage: 'Edit attribute'},
    duplicate: {id: 'admin.global_attributes.table.actions.duplicate', defaultMessage: 'Duplicate attribute'},
    delete: {id: 'admin.global_attributes.table.actions.delete', defaultMessage: 'Delete attribute'},
    comingSoon: {id: 'admin.global_attributes.table.actions.coming_soon', defaultMessage: 'Coming soon'},
});
