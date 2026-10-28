// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createColumnHelper, getCoreRowModel, useReactTable, type ColumnDef} from '@tanstack/react-table';
import type {ComponentType} from 'react';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {MessageDescriptor} from 'react-intl';
import {FormattedList, FormattedMessage, defineMessages, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {Link} from 'react-router-dom';

import type {ClientError} from '@mattermost/client';
import {AlertOutlineIcon, DotsHorizontalIcon, EyeOutlineIcon, MenuVariantIcon, OpenInNewIcon, PencilOutlineIcon, PowerPlugOutlineIcon, SyncIcon, TrashCanOutlineIcon} from '@mattermost/compass-icons/components';
import type IconProps from '@mattermost/compass-icons/components/props';
import {Button} from '@mattermost/compass-ui/components/button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {GlobalAttributeListingRow, GlobalAttributeSource, GlobalAttributeSourceKind} from '@mattermost/types/global_attributes';
import type {FieldType, PropertyField, PropertyFieldOption} from '@mattermost/types/properties';
import {valueRefersToOptions} from '@mattermost/types/properties';

import PropertyTypes from 'mattermost-redux/action_types/properties';
import {getConfig as getAdminConfig} from 'mattermost-redux/selectors/entities/admin';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {getPropertyFieldLabel, isPropertyFieldSynced} from 'mattermost-redux/utils/property_utils';

import {getPluginDisplayName} from 'selectors/plugins';
import {getIsMobileView} from 'selectors/views/browser';

import {
    CLASSIFICATIONS_FIELD_TYPE,
    CLASSIFICATIONS_MARKINGS_ADMIN_URL,
    CLASSIFICATIONS_TEMPLATE_FIELD_NAME,
    CLASSIFICATIONS_TEMPLATE_OBJECT_TYPE,
} from 'components/admin_console/classification_markings/utils';
import AlertBanner from 'components/alert_banner';
import {useInstalledPluginIds, useIsFieldOrphaned, usePluginInventoryLoaded} from 'components/common/hooks/use_field_orphaned';
import LoadingScreen from 'components/loading_screen';
import * as Menu from 'components/menu';

import {getHistory} from 'utils/browser_history';
import {LicenseSkus} from 'utils/constants';
import {allOwnersAreUninstalledPlugins} from 'utils/properties';

import type {GlobalState} from 'types/store';

import {resourceTypeLabels} from './attribute_details/attribute_applies_to_constants';
import type {ResourceObjectType} from './attribute_details/attribute_applies_to_constants';
import {externalSourceMessages} from './attribute_details/external_source';
import type {AttributeTypeId} from './attribute_type';
import {ATTRIBUTE_TYPE_DESCRIPTOR, ATTRIBUTE_TYPE_FALLBACK_LABEL, getAttributeTypeDescriptor, getTypeLabelForField} from './attribute_type';
import {CLASSIFICATION_ATTRIBUTE_ROUTE} from './classification_attribute';
import {attributeDetailsRoute} from './constants';
import {useGlobalAttributeFieldDelete} from './global_attribute_delete_modal';
import type {NameConflict} from './name_conflict';
import {nameConflictText} from './name_conflict';
import useGlobalAttributesListing from './use_global_attributes_listing';
import {useOwnersLabel} from './use_owners_label';
import {deleteAttributeField, syncUserAttributeFieldDelete} from './utils';

import {it} from '../admin_definition_helpers';
import {AdminConsoleListTable, type TableMeta} from '../list_table';

import './global_attributes_table.scss';

// list_table identifies rows by a top-level id.
type ListingTableRow = GlobalAttributeListingRow & {id: string};

const columnHelper = createColumnHelper<ListingTableRow>();

export function getTypeIcon(typeId: AttributeTypeId | FieldType): ComponentType<IconProps> {
    return ATTRIBUTE_TYPE_DESCRIPTOR[typeId as AttributeTypeId]?.icon ?? MenuVariantIcon;
}

export function getDisplayName(field: PropertyField): string {
    return getPropertyFieldLabel(field);
}

// Identifies the single Classification Markings template field by its literal
// name + type + object_type + group_id combo. There is no data-driven ownership
// flag (attrs.protected/top-level `protected`) for this template field.
//
// The type is part of it because the name alone is not reserved: an attribute
// named `classification` of any other type is an ordinary attribute, and must
// stay editable and deletable here — that is the only way to clear the conflict
// the Classification Markings page reports.
export function isClassificationMarkingsField(field: PropertyField, groupId: string): boolean {
    return (
        field.name === CLASSIFICATIONS_TEMPLATE_FIELD_NAME &&
        field.type === CLASSIFICATIONS_FIELD_TYPE &&
        field.object_type === CLASSIFICATIONS_TEMPLATE_OBJECT_TYPE &&
        field.group_id === groupId
    );
}

// Mirrors the classification_attribute route's own gate. Below Enterprise
// Advanced, or without the flag, the route is hidden, so Edit must not offer it.
function useClassificationAttributePageReachable(): boolean {
    return useSelector((state: GlobalState) => {
        const config = getAdminConfig(state);
        return it.minLicenseTier(LicenseSkus.EnterpriseAdvanced)(config, state, getLicense(state)) &&
            it.configIsTrue('FeatureFlags', 'ChannelAttributes')(config);
    });
}

export function getTypeLabel(typeId: AttributeTypeId | FieldType): MessageDescriptor {
    return ATTRIBUTE_TYPE_DESCRIPTOR[typeId as AttributeTypeId]?.label ?? ATTRIBUTE_TYPE_FALLBACK_LABEL;
}

type SourceKind = GlobalAttributeSourceKind;

// 'external' covers every identity source sync; getPropertyFieldSyncSources
// names which. The listing rows carry the server's own classification
// (source_kind); this is for a single field outside the listing.
export function getSourceKind(field: PropertyField): SourceKind {
    const attrs = field.attrs ?? {};
    if (attrs.source_plugin_id && attrs.protected) {
        return 'plugin';
    }
    if (isPropertyFieldSynced(field)) {
        return 'external';
    }
    return 'managed';
}

const SOURCE_ICONS: Partial<Record<SourceKind, ComponentType<IconProps>>> = {
    plugin: PowerPlugOutlineIcon,
    external: SyncIcon,
};

export function getSourceIcon(kind: SourceKind): ComponentType<IconProps> | undefined {
    return SOURCE_ICONS[kind];
}

type ClassificationAwareCellProps = {
    row: GlobalAttributeListingRow;
};

function SourceCell({row}: ClassificationAwareCellProps) {
    const {formatMessage} = useIntl();
    const {field, owners, source_kind: kind, sync_sources: syncSources} = row;
    const ownersLabel = useOwnersLabel(owners);
    const pluginId = field.attrs?.source_plugin_id as string | undefined;
    const pluginDisplayName = useSelector((state: GlobalState) => getPluginDisplayName(state, pluginId));
    const SyncKindIcon = getSourceIcon('external');

    let content: React.ReactNode;
    if (row.is_classification) {
        // Not a plugin or an identity source sync, so it gets no source icon.
        content = <FormattedMessage {...sourceLabels.classificationMarkings}/>;
    } else if (kind === 'plugin') {
        content = (
            <>
                <PowerPlugOutlineIcon size={16}/>
                {pluginDisplayName}
            </>
        );
    } else if (owners.length > 0 || syncSources.length > 0) {
        // An owned field can also be synced from an identity source, so both are shown.
        content = (
            <>
                {owners.length > 0 && (
                    <span className='GlobalAttributesTable__source'>
                        <PowerPlugOutlineIcon size={16}/>
                        <FormattedMessage
                            {...sourceLabels.ownedBy}
                            values={{owners: ownersLabel}}
                        />
                    </span>
                )}
                {syncSources.length > 0 && (
                    <span className='GlobalAttributesTable__source'>
                        {SyncKindIcon && <SyncKindIcon size={16}/>}
                        <FormattedList
                            type='unit'
                            value={syncSources.map((source) => formatMessage(externalSourceMessages[source].title))}
                        />
                    </span>
                )}
            </>
        );
    } else {
        content = <FormattedMessage {...sourceLabels.managed}/>;
    }

    return (
        <span
            className='GlobalAttributesTable__source'
            data-testid='global-attribute-source'
        >
            {content}
        </span>
    );
}

function AppliesToCell({types}: {types: ResourceObjectType[]}) {
    if (types.length === 0) {
        return <span data-testid='global-attribute-applies-to'>{'—'}</span>;
    }

    return (
        <ul
            className='GlobalAttributesTable__appliesTo'
            data-testid='global-attribute-applies-to'
        >
            {types.map((type) => (
                <li key={type}>
                    <span className='GlobalAttributesTable__appliesToChip'>
                        <FormattedMessage {...resourceTypeLabels[type]}/>
                    </span>
                </li>
            ))}
        </ul>
    );
}

function OptionsCell({field}: {field: PropertyField}) {
    if (!valueRefersToOptions(field)) {
        return <FormattedMessage {...optionsLabels.freeText}/>;
    }

    const attrs = field.attrs;
    const omitted = Boolean(attrs?.options_omitted);
    const count = omitted ?
        ((attrs?.options_count as number | undefined) ?? 0) :
        ((attrs?.options as PropertyFieldOption[] | undefined)?.length ?? 0);

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

function toNameConflict(conflict: GlobalAttributeListingRow['name_conflict']): NameConflict | undefined {
    return conflict && {field: conflict.field, ownerTemplate: conflict.owner_template, exact: conflict.exact};
}

function AttributeCell({row}: ClassificationAwareCellProps) {
    const {formatMessage} = useIntl();
    const {field} = row;
    const nameConflict = toNameConflict(row.name_conflict);
    const conflictText = nameConflict ? nameConflictText(nameConflict, formatMessage) : '';

    return (
        <span className='GlobalAttributesTable__attribute'>
            <span className='GlobalAttributesTable__nameRow'>
                <span
                    className='GlobalAttributesTable__name'
                    data-testid='global-attribute-name'
                >
                    {getDisplayName(field)}
                </span>
                {nameConflict && (
                    <WithTooltip title={conflictText}>
                        <span
                            className='GlobalAttributesTable__nameConflict'

                            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- WithTooltip's useFocus only fires on its cloned child, so without this the warning is mouse-only
                            tabIndex={0}

                            // The icon is the whole content, so the element needs a
                            // role that admits a name for aria-label to be announced.
                            role='img'
                            aria-label={conflictText}
                            data-testid={`global-attribute-name-conflict-${field.id}`}
                        >
                            <AlertOutlineIcon
                                size={16}
                                aria-hidden={true}
                            />
                        </span>
                    </WithTooltip>
                )}
            </span>
            {row.is_classification && (
                <span
                    id={classificationSubtitleId(field.id)}
                    className='GlobalAttributesTable__subtitle'
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
    disabled: boolean;
    onDeleteError: (message: string | null) => void;
    onDeleted: () => void;
    onDeleteModalExited: () => void;
};

function ActionsCell({row, isMobileView, pluginInventoryLoaded, disabled, onDeleteError, onDeleted, onDeleteModalExited}: ActionsCellProps) {
    const {field, owners} = row;
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
    const isPluginOwned = row.source_kind === 'plugin';
    const isOrphaned = pluginInventoryLoaded && fieldLooksOrphaned;
    const isPluginManaged = isPluginOwned && !isOrphaned;

    // Deleting an attribute deletes its owned Users field, so an owned attribute
    // is deletable only once every owner is an uninstalled plugin. Until the
    // plugin inventory settles, whether those owners are gone is not known yet.
    const installedPluginIds = useInstalledPluginIds();
    const ownersLabel = useOwnersLabel(owners);
    const isOwned = owners.length > 0;
    const ownersGone = pluginInventoryLoaded && allOwnersAreUninstalledPlugins(owners, installedPluginIds);
    const isOwnerManaged = isOwned && !ownersGone;

    // Page-level read-only (non-sysadmin via schema isDisabled) and plugin-owned
    // fields both open the details page as view-only; Delete stays off for those
    // plus still-installed plugin-managed or owner-managed rows.
    const isViewOnly = disabled || isPluginOwned;
    const isDeleteDisabled = disabled || isPluginManaged || isOwnerManaged;

    let orphanInfo: {ownerPluginIds: string[]} | {sourcePluginId?: string} | undefined;
    if (isOwned) {
        orphanInfo = {ownerPluginIds: owners.map((owner) => owner.id)};
    } else if (isOrphaned) {
        orphanInfo = {sourcePluginId: field.attrs?.source_plugin_id as string | undefined};
    }

    const handleConfirmed = useCallback(async () => {
        onDeleteError(null);

        try {
            await deleteAttributeField(field.object_type, field.id);
            dispatch({type: PropertyTypes.PROPERTY_FIELD_DELETED, data: {fieldId: field.id}});
            syncUserAttributeFieldDelete(dispatch, field.object_type, field.id);
        } catch (error) {
            onDeleteError(formatMessage(
                (error as ClientError)?.status_code === 409 ? actionsLabels.deleteErrorHasDependents : actionsLabels.deleteErrorGeneric,
            ));
            return;
        }

        onDeleted();
    }, [dispatch, field.id, field.object_type, formatMessage, onDeleteError, onDeleted]);

    // Classification's definition lives on Classification Markings; this row only
    // offers the open-in-new link there. Row click still opens the attribute page
    // when that route is reachable.
    if (row.is_classification) {
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
                leadingElement={isViewOnly ? <EyeOutlineIcon size={18}/> : <PencilOutlineIcon size={18}/>}
                onClick={() => getHistory().push(attributeDetailsRoute(field.id))}
                labels={<FormattedMessage {...(isViewOnly ? actionsLabels.view : actionsLabels.edit)}/>}
            />
            <Menu.Item
                id={`${menuId}-delete`}
                disabled={isDeleteDisabled}
                isDestructive={true}
                leadingElement={<TrashCanOutlineIcon size={18}/>}
                onClick={isDeleteDisabled ? undefined : () => promptDelete(
                    getDisplayName(field),
                    handleConfirmed,
                    orphanInfo,
                    onDeleteModalExited,
                )}
                labels={(
                    <>
                        <span><FormattedMessage {...actionsLabels.delete}/></span>
                        {isPluginManaged && <span><FormattedMessage {...actionsLabels.pluginManaged}/></span>}
                        {!isPluginManaged && isOwnerManaged && (
                            <span>
                                <FormattedMessage
                                    {...actionsLabels.ownerManaged}
                                    values={{owners: ownersLabel}}
                                />
                            </span>
                        )}
                    </>
                )}
            />
        </Menu.Container>
    );
}

type GlobalAttributesTableProps = {
    searchQuery?: string;
    source?: GlobalAttributeSource;

    // Resets the search and every filter; offered when they leave nothing to show.
    onClearFilters?: () => void;
    disabled?: boolean;
};

export default function GlobalAttributesTable({searchQuery = '', source, onClearFilters, disabled = false}: GlobalAttributesTableProps) {
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [deleteModalExited, setDeleteModalExited] = useState(false);
    const bannerRef = useRef<HTMLDivElement>(null);

    const classificationAttributePageReachable = useClassificationAttributePageReachable();
    const isMobileView = useSelector(getIsMobileView);

    const {rows: listingRows, loaded, error: loadError, refetch} = useGlobalAttributesListing({term: searchQuery, source});

    const rows = useMemo<ListingTableRow[]>(
        () => listingRows.map((row) => ({...row, id: row.field.id})),
        [listingRows],
    );

    // The Source column resolves plugin-created and plugin-owned rows to a plugin
    // display name, but server-only plugins are absent from the webapp manifest
    // registry — their names live in the admin plugin statuses, which nothing else
    // on this page loads. Fetched once, and only when such a row is actually present.
    const hasPluginOwnedFields = useMemo(() => rows.some((row) => (
        Boolean(row.field.attrs?.source_plugin_id) || row.owners.some((owner) => owner.type === 'plugin')
    )), [rows]);

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
    const pluginInventoryLoaded = usePluginInventoryLoaded(hasPluginOwnedFields);
    const pluginInventoryLoadedRef = useRef(pluginInventoryLoaded);
    pluginInventoryLoadedRef.current = pluginInventoryLoaded;

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

    const handleRowClick = useCallback((fieldId: string) => {
        const row = rows.find((candidate) => candidate.id === fieldId);
        if (!row) {
            return;
        }

        // Classification has its own page (or the markings page when that edit route is hidden).
        if (row.is_classification) {
            getHistory().push(classificationAttributePageReachable ? CLASSIFICATION_ATTRIBUTE_ROUTE : CLASSIFICATIONS_MARKINGS_ADMIN_URL);
            return;
        }

        getHistory().push(attributeDetailsRoute(fieldId));
    }, [classificationAttributePageReachable, rows]);

    const columns = useMemo<Array<ColumnDef<ListingTableRow, any>>>(() => [
        columnHelper.accessor((row) => getDisplayName(row.field), {
            id: 'attribute',
            header: () => <FormattedMessage {...messages.attribute}/>,
            cell: ({row}) => <AttributeCell row={row.original}/>,
            enableSorting: false,
            enableHiding: false,
        }),
        columnHelper.accessor((row) => row.field.type, {
            id: 'type',
            header: () => <FormattedMessage {...messages.type}/>,
            cell: ({row}) => {
                const {field} = row.original;
                const descriptor = getAttributeTypeDescriptor(field);
                const label = getTypeLabelForField(field);
                const Icon = descriptor.fieldType === field.type ? descriptor.icon : MenuVariantIcon;

                return (
                    <span
                        className='GlobalAttributesTable__type'
                        data-testid='global-attribute-type'
                    >
                        <Icon size={16}/>
                        <FormattedMessage {...label}/>
                    </span>
                );
            },
            enableSorting: false,
            enableHiding: false,
        }),
        columnHelper.display({
            id: 'applies_to',
            header: () => <FormattedMessage {...messages.appliesTo}/>,
            cell: ({row}) => <AppliesToCell types={row.original.applies_to}/>,
            enableHiding: false,
        }),
        columnHelper.display({
            id: 'source',
            header: () => <FormattedMessage {...messages.source}/>,
            cell: ({row}) => <SourceCell row={row.original}/>,
            enableHiding: false,
        }),
        columnHelper.display({
            id: 'options',
            header: () => <FormattedMessage {...messages.options}/>,
            cell: ({row}) => (
                <span data-testid='global-attribute-options'>
                    <OptionsCell field={row.original.field}/>
                </span>
            ),
            enableHiding: false,
        }),
        columnHelper.display({
            id: 'actions',
            cell: ({row}) => (
                <div
                    className='GlobalAttributesTable__actionsCell'
                    onClick={(event) => event.stopPropagation()}
                >
                    <ActionsCell
                        row={row.original}
                        isMobileView={isMobileView}
                        pluginInventoryLoaded={pluginInventoryLoadedRef.current}
                        disabled={disabled}
                        onDeleteError={setDeleteError}
                        onDeleted={refetch}
                        onDeleteModalExited={handleDeleteModalExited}
                    />
                </div>
            ),
            enableHiding: false,
        }),
    ], [isMobileView, handleDeleteModalExited, refetch, disabled]);

    const table = useReactTable<ListingTableRow>({
        data: rows,
        columns,
        getCoreRowModel: getCoreRowModel<ListingTableRow>(),
        enableSortingRemoval: false,
        enableMultiSort: false,
        renderFallbackValue: '',
        meta: {
            tableId: 'globalAttributes',
            disablePaginationControls: true,
            onRowClick: handleRowClick,
        } as TableMeta,
        manualPagination: true,
        enableColumnPinning: false,
    });

    // A failed refetch keeps the rows already shown; only a first load that
    // fails has nothing to show.
    if (loadError && !loaded) {
        return (
            <div
                className='GlobalAttributesTable__empty'
                data-testid='global-attributes-error'
            >
                <FormattedMessage {...messages.loadError}/>
            </div>
        );
    }

    if (!loaded) {
        return <LoadingScreen/>;
    }

    if (rows.length === 0) {
        const isSearching = Boolean(searchQuery.trim());
        if (!isSearching && !source) {
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
            <div
                className='GlobalAttributesTable__empty'
                data-testid='global-attributes-empty-search'
            >
                <FormattedMessage {...(source ? messages.emptyFiltered : messages.emptySearch)}/>
                {onClearFilters && (
                    <Button
                        emphasis='tertiary'
                        onClick={onClearFilters}
                        data-testid='global-attributes-clear-filters'
                    >
                        <FormattedMessage {...messages.clearFilters}/>
                    </Button>
                )}
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
            <AdminConsoleListTable<ListingTableRow> table={table}/>
        </div>
    );
}

const messages = defineMessages({
    attribute: {id: 'admin.global_attributes.table.attribute', defaultMessage: 'Attribute'},
    type: {id: 'admin.global_attributes.table.type', defaultMessage: 'Type'},
    appliesTo: {id: 'admin.global_attributes.table.applies_to', defaultMessage: 'Applies to'},
    source: {id: 'admin.global_attributes.table.source', defaultMessage: 'Source'},
    options: {id: 'admin.global_attributes.table.options', defaultMessage: 'Options'},
    classificationSubtitle: {
        id: 'admin.global_attributes.table.attribute.classification_subtitle',

        // Scoped to the definition on purpose: the resources it applies to are
        // editable on its own page.
        defaultMessage: 'Definition is read-only',
    },
    empty: {
        id: 'admin.global_attributes.table.empty',
        defaultMessage: 'No attributes yet. Click "New attribute" to create one.',
    },
    emptySearch: {
        id: 'admin.global_attributes.table.empty_search',
        defaultMessage: 'No attributes match your search.',
    },
    emptyFiltered: {
        id: 'admin.global_attributes.table.empty_filtered',
        defaultMessage: 'No attributes match your search or filters.',
    },
    clearFilters: {id: 'admin.global_attributes.table.clear_filters', defaultMessage: 'Clear filters'},
    loadError: {id: 'admin.global_attributes.table.load_error', defaultMessage: 'There was an error while loading attributes.'},
});

export const typeLabels = {
    text: ATTRIBUTE_TYPE_DESCRIPTOR.text.label,
    email: ATTRIBUTE_TYPE_DESCRIPTOR.email.label,
    phone: ATTRIBUTE_TYPE_DESCRIPTOR.phone.label,
    url: ATTRIBUTE_TYPE_DESCRIPTOR.url.label,
    select: ATTRIBUTE_TYPE_DESCRIPTOR.select.label,
    multiselect: ATTRIBUTE_TYPE_DESCRIPTOR.multiselect.label,
    rank: ATTRIBUTE_TYPE_DESCRIPTOR.rank.label,
    graph: ATTRIBUTE_TYPE_DESCRIPTOR.graph.label,
    fallback: ATTRIBUTE_TYPE_FALLBACK_LABEL,
};

const sourceLabels = defineMessages({
    managed: {id: 'admin.global_attributes.table.source.managed', defaultMessage: 'Managed here'},
    ownedBy: {id: 'admin.global_attributes.table.source.owned_by', defaultMessage: 'Managed by {owners}'},
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
    view: {id: 'admin.global_attributes.table.actions.view', defaultMessage: 'View attribute'},
    delete: {id: 'admin.global_attributes.table.actions.delete', defaultMessage: 'Delete attribute'},
    pluginManaged: {id: 'admin.global_attributes.table.actions.plugin_managed', defaultMessage: 'Plugin-managed'},
    ownerManaged: {id: 'admin.global_attributes.table.actions.owner_managed', defaultMessage: 'Managed by {owners}'},
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
