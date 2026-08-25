// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createColumnHelper, getCoreRowModel, useReactTable, type ColumnDef} from '@tanstack/react-table';
import classNames from 'classnames';
import type {ComponentType} from 'react';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedMessage, defineMessages, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {Link} from 'react-router-dom';

import type {ClientError} from '@mattermost/client';
import {ChevronDownCircleOutlineIcon, ContentCopyIcon, DotsHorizontalIcon, FormatListBulletedIcon, MenuVariantIcon, OpenInNewIcon, PencilOutlineIcon, PowerPlugOutlineIcon, SortAscendingIcon, SyncIcon, TrashCanOutlineIcon} from '@mattermost/compass-icons/components';
import type IconProps from '@mattermost/compass-icons/components/props';
import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {FieldType, PropertyField, PropertyFieldOption} from '@mattermost/types/properties';
import {valueRefersToOptions} from '@mattermost/types/properties';

import PropertyTypes from 'mattermost-redux/action_types/properties';
import {getPluginStatuses} from 'mattermost-redux/actions/admin';
import {fetchPropertyFields} from 'mattermost-redux/actions/properties';
import {getConfig as getAdminConfig} from 'mattermost-redux/selectors/entities/admin';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {getPropertyFieldsForObjectTypeAndGroup, getPropertyGroupByName} from 'mattermost-redux/selectors/entities/properties';

import {getPluginDisplayName} from 'selectors/plugins';
import {getIsMobileView} from 'selectors/views/browser';

import {
    CLASSIFICATIONS_MARKINGS_ADMIN_URL,
    CLASSIFICATIONS_TEMPLATE_FIELD_NAME,
    CLASSIFICATIONS_TEMPLATE_OBJECT_TYPE,
} from 'components/admin_console/classification_markings/utils';
import AlertBanner from 'components/alert_banner';
import {useIsFieldOrphaned} from 'components/common/hooks/use_field_orphaned';
import LoadingScreen from 'components/loading_screen';
import * as Menu from 'components/menu';

import {LicenseSkus} from 'utils/constants';

import type {GlobalState} from 'types/store';

import {GLOBAL_ATTRIBUTES_GROUP_NAME, GLOBAL_ATTRIBUTES_OBJECT_TYPE, GLOBAL_ATTRIBUTES_TARGET_TYPE} from './constants';
import {useGlobalAttributeFieldDelete} from './global_attribute_delete_modal';
import {deleteAttributeField} from './utils';

import {it} from '../admin_definition_helpers';
import {AdminConsoleListTable} from '../list_table';

import './global_attributes_table.scss';

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

// Identifies the single Classification Markings template field by its literal
// name + object_type + group_id combo. There is no data-driven ownership flag
// (attrs.protected/top-level `protected`) for this template field.
export function isClassificationMarkingsField(field: PropertyField, groupId: string): boolean {
    return (
        field.name === CLASSIFICATIONS_TEMPLATE_FIELD_NAME &&
        field.object_type === CLASSIFICATIONS_TEMPLATE_OBJECT_TYPE &&
        field.group_id === groupId
    );
}

// Mirrors admin_definition.tsx's own `classification_markings` route visibility rule
// (isHidden: it.any(it.not(it.minLicenseTier(Enterprise)), it.not(it.configIsTrue('FeatureFlags',
// 'ClassificationMarkings')))) by calling the exact same `it.minLicenseTier`/`it.configIsTrue`
// helpers the route rule itself calls — not a re-implementation of their bodies, so the two can
// never drift — reading from the same entities/admin config tree the route rule itself reads.
// Without this, the chevron/subtitle could point at a route that's actually hidden (independent
// flag from the one gating this listing page).
function useClassificationMarkingsReachable(): boolean {
    return useSelector((state: GlobalState) => {
        const config = getAdminConfig(state);
        const license = getLicense(state);
        return it.minLicenseTier(LicenseSkus.Enterprise)(config, state, license) &&
            it.configIsTrue('FeatureFlags', 'ClassificationMarkings')(config);
    });
}

export function getTypeLabel(fieldType: FieldType): MessageDescriptor {
    return (typeLabels as Partial<Record<FieldType, MessageDescriptor>>)[fieldType] ?? typeLabels.fallback;
}

type SourceKind = 'plugin' | 'ldap_and_saml' | 'ldap' | 'saml' | 'managed';

export function getSourceKind(field: PropertyField): SourceKind {
    const attrs = field.attrs ?? {};
    if (attrs.source_plugin_id && attrs.protected) {
        return 'plugin';
    }
    if (attrs.ldap && attrs.saml) {
        return 'ldap_and_saml';
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
    ldap_and_saml: SyncIcon,
    ldap: SyncIcon,
    saml: SyncIcon,
};

export function getSourceIcon(kind: SourceKind): ComponentType<IconProps> | undefined {
    return SOURCE_ICONS[kind];
}

type ClassificationAwareCellProps = {
    field: PropertyField;
    isClassificationRow: boolean;
};

function SourceCell({field, isClassificationRow}: ClassificationAwareCellProps) {
    const pluginId = field.attrs?.source_plugin_id as string | undefined;
    const pluginDisplayName = useSelector((state: GlobalState) => getPluginDisplayName(state, pluginId));

    const kind = getSourceKind(field);

    let content: React.ReactNode;
    if (isClassificationRow) {
        content = <FormattedMessage {...sourceLabels.classificationMarkings}/>;
    } else if (kind === 'plugin') {
        content = pluginDisplayName;
    } else if (kind === 'ldap_and_saml') {
        content = <FormattedMessage {...sourceLabels.ldapAndSaml}/>;
    } else if (kind === 'ldap') {
        content = <FormattedMessage {...sourceLabels.ldap}/>;
    } else if (kind === 'saml') {
        content = <FormattedMessage {...sourceLabels.saml}/>;
    } else {
        content = <FormattedMessage {...sourceLabels.managed}/>;
    }

    // The classification row identifies its source via text alone ("Classification
    // Markings"), not a plugin/ldap/saml/managed kind, so it doesn't get one of those icons.
    const Icon = isClassificationRow ? undefined : getSourceIcon(kind);

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
    if (!valueRefersToOptions(field)) {
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

function classificationSubtitleId(fieldId: string): string {
    return `global-attribute-classification-subtitle-${fieldId}`;
}

function AttributeCell({field, isClassificationRow}: ClassificationAwareCellProps) {
    return (
        <span className='GlobalAttributesTable__attribute'>
            <span
                className={classNames('GlobalAttributesTable__name', {'GlobalAttributesTable__name--classification': isClassificationRow})}
                data-testid='global-attribute-name'
            >
                {getDisplayName(field)}
            </span>
            {isClassificationRow && (
                <span
                    id={classificationSubtitleId(field.id)}
                    className='GlobalAttributesTable__subtitle GlobalAttributesTable__subtitle--classification'
                    data-testid={`global-attribute-classification-subtitle-${field.id}`}
                >
                    <FormattedMessage {...messages.classificationSubtitle}/>
                </span>
            )}
        </span>
    );
}

type ActionsCellProps = ClassificationAwareCellProps & {
    isMobileView: boolean;
    pluginInventoryLoaded: boolean;
    onDeleteError: (message: string | null) => void;
    onDeleteModalExited: () => void;
};

function ActionsCell({field, isClassificationRow, isMobileView, pluginInventoryLoaded, onDeleteError, onDeleteModalExited}: ActionsCellProps) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const promptDelete = useGlobalAttributeFieldDelete();
    const menuId = `global-attribute-actions-${field.id}`;

    // A plugin-owned field is server-protected only while its plugin is installed,
    // so the item stays disabled with a reason rather than offering a dead action.
    // Once the plugin is uninstalled the server allows the delete (see
    // checkFieldDeleteAccess in server/channels/app/properties/access_control.go) —
    // that is how an admin cleans up what the plugin left behind.
    // Not short-circuited into the hook call, which has to run unconditionally.
    const fieldLooksOrphaned = useIsFieldOrphaned(field);
    const isOrphaned = pluginInventoryLoaded && fieldLooksOrphaned;
    const isPluginManaged = getSourceKind(field) === 'plugin' && !isOrphaned;

    const handleConfirmed = useCallback(async () => {
        onDeleteError(null);

        try {
            await deleteAttributeField(field.id);
            dispatch({type: PropertyTypes.PROPERTY_FIELD_DELETED, data: {fieldId: field.id}});
        } catch (error) {
            onDeleteError(formatMessage(
                (error as ClientError)?.status_code === 409 ? actionsLabels.deleteErrorHasDependents : actionsLabels.deleteErrorGeneric,
            ));
        }
    }, [dispatch, field.id, formatMessage, onDeleteError]);

    if (isClassificationRow) {
        const classificationLinkLabel = formatMessage(actionsLabels.classificationLink);

        return (
            <WithTooltip
                title={classificationLinkLabel}
                disabled={isMobileView}
            >
                <Link
                    to={CLASSIFICATIONS_MARKINGS_ADMIN_URL}
                    className='GlobalAttributesTable__link--classification'
                    aria-label={classificationLinkLabel}
                    aria-describedby={classificationSubtitleId(field.id)}
                    data-testid={`global-attribute-classification-link-${field.id}`}
                >
                    <OpenInNewIcon
                        size={18}
                        aria-hidden={true}
                    />
                </Link>
            </WithTooltip>
        );
    }

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
                disabled={isPluginManaged}
                isDestructive={true}
                leadingElement={<TrashCanOutlineIcon size={18}/>}
                onClick={isPluginManaged ? undefined : () => promptDelete(
                    getDisplayName(field),
                    handleConfirmed,
                    isOrphaned ? {sourcePluginId: field.attrs?.source_plugin_id as string | undefined} : undefined,
                    onDeleteModalExited,
                )}
                labels={(
                    <>
                        <span><FormattedMessage {...actionsLabels.delete}/></span>
                        {isPluginManaged && <span><FormattedMessage {...actionsLabels.pluginManaged}/></span>}
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
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [deleteModalExited, setDeleteModalExited] = useState(false);
    const bannerRef = useRef<HTMLDivElement>(null);

    const groupId = useSelector((state: GlobalState) =>
        getPropertyGroupByName(state, GLOBAL_ATTRIBUTES_GROUP_NAME)?.id ?? '',
    );

    const classificationMarkingsReachable = useClassificationMarkingsReachable();
    const isMobileView = useSelector(getIsMobileView);

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

    // The Source column resolves plugin-owned rows to a plugin display name, but
    // server-only plugins are absent from the webapp manifest registry — their names
    // live in the admin plugin statuses, which nothing else on this page loads.
    // Fetched once, and only when a plugin-owned row is actually present.
    const hasPluginOwnedFields = useMemo(() => fields.some((field) => Boolean(field.attrs?.source_plugin_id)), [fields]);
    const pluginStatusesRequested = useRef(false);

    // Whether the plugin inventory is known yet. This gates the orphan check
    // rather than the Source column, which degrades harmlessly to the plugin ID:
    // an inventory that has not arrived is indistinguishable from one where
    // nothing is installed, and isFieldOrphaned reads the latter as "every
    // plugin-owned field is orphaned". Acting on that would briefly offer Delete
    // on a still-protected field, behind a dialog wrongly claiming the plugin was
    // uninstalled -- and the server would then refuse it anyway. Settled rather
    // than resolved: a failed fetch still leaves the inventory as good as it will
    // get, and staying false forever would strand genuine leftovers as
    // undeletable.
    const [pluginInventoryLoaded, setPluginInventoryLoaded] = useState(false);

    useEffect(() => {
        if (!hasPluginOwnedFields || pluginStatusesRequested.current) {
            return;
        }

        pluginStatusesRequested.current = true;
        dispatch(getPluginStatuses()).finally(() => setPluginInventoryLoaded(true));
    }, [dispatch, hasPluginOwnedFields]);

    const handleDeleteModalExited = useCallback(() => setDeleteModalExited(true), []);

    // The banner sits above the table, so a delete triggered from a row further
    // down can land off-screen. Two things make the timing here load-bearing:
    //
    // GenericModal passes restoreFocus, so on close react-bootstrap returns focus
    // to the row's actions button -- far down the list -- and focusing an
    // off-screen element scrolls it back into view. Scrolling before that happens
    // is simply undone, so the page has to settle first.
    //
    // GenericModal also starts closing *before* it invokes handleConfirm, and the
    // delete request may finish either side of the modal's fade. So the error and
    // the exit arrive in either order; act only once both have landed.
    useEffect(() => {
        if (!deleteError || !deleteModalExited) {
            return;
        }

        // Disarmed so the next delete waits for its own modal to close rather
        // than acting on this attempt's stale exit.
        setDeleteModalExited(false);

        // Focus without its own scroll, then scroll deliberately: the banner ends
        // up owning focus for keyboard and screen reader users -- who would
        // otherwise be returned to a row button and have to hunt for the error --
        // and the browser never scrolls anywhere we did not ask it to.
        bannerRef.current?.focus?.({preventScroll: true});
        bannerRef.current?.closest('.admin-console__wrapper')?.scrollTo?.({top: 0});
    }, [deleteError, deleteModalExited]);

    const rows = useMemo(
        () => [...fields].sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b))),
        [fields],
    );

    const columns = useMemo<Array<ColumnDef<PropertyField, any>>>(() => {
        const isClassificationRow = (field: PropertyField) =>
            isClassificationMarkingsField(field, groupId) && classificationMarkingsReachable;

        return [
            columnHelper.accessor((row) => getDisplayName(row), {
                id: 'attribute',
                header: () => <FormattedMessage {...messages.attribute}/>,
                cell: ({row}) => (
                    <AttributeCell
                        field={row.original}
                        isClassificationRow={isClassificationRow(row.original)}
                    />
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
                cell: ({row}) => (
                    <SourceCell
                        field={row.original}
                        isClassificationRow={isClassificationRow(row.original)}
                    />
                ),
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
                cell: ({row}) => (
                    <ActionsCell
                        field={row.original}
                        isClassificationRow={isClassificationRow(row.original)}
                        isMobileView={isMobileView}
                        pluginInventoryLoaded={pluginInventoryLoaded}
                        onDeleteError={setDeleteError}
                        onDeleteModalExited={handleDeleteModalExited}
                    />
                ),
                enableHiding: false,
            }),
        ];
    }, [groupId, classificationMarkingsReachable, isMobileView, pluginInventoryLoaded, handleDeleteModalExited]);

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
            {/* Kept mounted with only its content swapped in -- an alert inserted at the
                same moment as its text is not reliably announced (same reason
                attribute_external_source.tsx keeps its status region mounted). */}
            <div
                ref={bannerRef}
                role='alert'

                // Focused programmatically when a delete fails, so it takes focus
                // without becoming a stop in the normal tab order.
                tabIndex={-1}
            >
                {deleteError && (
                    <AlertBanner
                        id='global-attributes-delete-error'
                        mode='danger'
                        message={deleteError}
                        onDismiss={() => setDeleteError(null)}
                    />
                )}
            </div>
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
        defaultMessage: 'No attributes yet. Click "New attribute" to create one.',
    },
    loadError: {id: 'admin.global_attributes.table.load_error', defaultMessage: 'There was an error while loading attributes.'},
    classificationSubtitle: {
        id: 'admin.global_attributes.table.attribute.classification_subtitle',
        defaultMessage: 'Read-only',
    },
});

export const typeLabels = defineMessages({
    text: {id: 'admin.global_attributes.table.type.text', defaultMessage: 'Text'},
    select: {id: 'admin.global_attributes.table.type.select', defaultMessage: 'Select'},
    multiselect: {id: 'admin.global_attributes.table.type.multiselect', defaultMessage: 'Multiselect'},
    rank: {id: 'admin.global_attributes.table.type.rank', defaultMessage: 'Ranked'},
    fallback: {id: 'admin.global_attributes.table.type.fallback', defaultMessage: 'Other'},
});

const sourceLabels = defineMessages({
    ldapAndSaml: {id: 'admin.global_attributes.table.source.ldap_and_saml', defaultMessage: 'AD/LDAP, SAML'},
    ldap: {id: 'admin.global_attributes.table.source.ldap', defaultMessage: 'AD/LDAP'},
    saml: {id: 'admin.global_attributes.table.source.saml', defaultMessage: 'SAML'},
    managed: {id: 'admin.global_attributes.table.source.managed', defaultMessage: 'Managed here'},
    classificationMarkings: {
        id: 'admin.global_attributes.table.source.classification_markings',
        defaultMessage: 'Classification Markings',
    },
});

const optionsLabels = defineMessages({
    freeText: {id: 'admin.global_attributes.table.options.free_text', defaultMessage: 'Free Text'},
    count: {id: 'admin.global_attributes.table.options.count', defaultMessage: '{count, plural, one {# option} other {# options}}'},
});

export const actionsLabels = defineMessages({
    tooltip: {id: 'admin.global_attributes.table.actions.tooltip', defaultMessage: 'More actions'},
    menuLabel: {id: 'admin.global_attributes.table.actions.menu_label', defaultMessage: 'Select an action'},
    edit: {id: 'admin.global_attributes.table.actions.edit', defaultMessage: 'Edit attribute'},
    duplicate: {id: 'admin.global_attributes.table.actions.duplicate', defaultMessage: 'Duplicate attribute'},
    delete: {id: 'admin.global_attributes.table.actions.delete', defaultMessage: 'Delete attribute'},
    comingSoon: {id: 'admin.global_attributes.table.actions.coming_soon', defaultMessage: 'Coming soon'},
    pluginManaged: {id: 'admin.global_attributes.table.actions.plugin_managed', defaultMessage: 'Plugin-managed'},
    deleteErrorHasDependents: {
        id: 'admin.global_attributes.confirm.delete.error.has_dependents',
        defaultMessage: "This attribute can't be deleted because other attributes are still linked to it. Remove those links first, then try again.",
    },
    deleteErrorGeneric: {
        id: 'admin.global_attributes.confirm.delete.error.generic',
        defaultMessage: 'An error occurred while deleting this attribute. Please try again.',
    },
    classificationLink: {
        id: 'admin.global_attributes.table.actions.classification_link',
        defaultMessage: 'Open Classification Markings',
    },
});
