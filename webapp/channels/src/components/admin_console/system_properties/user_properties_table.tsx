// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createColumnHelper, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef} from '@tanstack/react-table';
import type {ReactNode} from 'react';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {FormattedMessage, defineMessages, useIntl} from 'react-intl';
import styled, {css} from 'styled-components';

import {AlertOutlineIcon, InformationOutlineIcon, PlusIcon} from '@mattermost/compass-icons/components';
import {WithTooltip} from '@mattermost/shared/components/tooltip';
import {supportsOptions, type UserPropertyField} from '@mattermost/types/properties';
import {collectionToArray} from '@mattermost/types/utilities';

import AlertBanner from 'components/alert_banner';
import LoadingScreen from 'components/loading_screen';

import Constants from 'utils/constants';
import {CPA_FIELD_NAME_RESERVED_WORDS, filterCELIdentifier, slugifyForCEL} from 'utils/properties';

import {BorderlessInput, LinkButton} from './controls';
import {useIsFieldOrphaned} from './orphaned_fields_utils';
import type {SectionHook} from './section_utils';
import DotMenu from './user_properties_dot_menu';
import OrphanedFieldDeleteButton from './user_properties_orphaned_delete_button';
import SelectType from './user_properties_type_menu';
import type {UserPropertyFields} from './user_properties_utils';
import {isCreatePending, useUserPropertyFields, ValidationWarningNameInvalidCEL, ValidationWarningNameRequired, ValidationWarningNameTaken, ValidationWarningNameUnique} from './user_properties_utils';
import UserPropertyValues from './user_properties_values';

import {AdminConsoleListTable} from '../list_table';

const columnHelper = createColumnHelper<UserPropertyField>();

type FieldActions = {
    createField: (field: UserPropertyField) => void;
    updateField: (field: UserPropertyField) => void;
    deleteField: (id: string) => void;
    reorderField: (field: UserPropertyField, nextOrder: number) => void;
};

export const useUserPropertiesTable = (): SectionHook => {
    const [userPropertyFields, readIO, pendingIO, itemOps] = useUserPropertyFields();
    const nonDeletedCount = Object.values(userPropertyFields.data).filter((f: UserPropertyField) => f.delete_at === 0).length;

    const canCreate = nonDeletedCount < Constants.MAX_CUSTOM_ATTRIBUTES;

    const create = () => {
        itemOps.create();
    };

    const save = async () => {
        const newData = await pendingIO.commit();

        // reconcile - zero pending changes
        if (newData && !newData.errors) {
            readIO.setData(newData);
        }
    };

    const content = readIO.loading ? (
        <LoadingScreen/>
    ) : (
        <>
            <UserPropertiesTable
                data={userPropertyFields}
                canCreate={canCreate}
                createField={itemOps.create}
                updateField={itemOps.update}
                deleteField={itemOps.delete}
                reorderField={itemOps.reorder}
            />
            <ValidationBanners warnings={userPropertyFields.warnings}/>
            {canCreate && (
                <LinkButton onClick={create}>
                    <PlusIcon size={16}/>
                    <FormattedMessage
                        id='admin.system_properties.user_properties.add_property'
                        defaultMessage='Add attribute'
                    />
                </LinkButton>
            )}
        </>
    );

    return {
        content,
        loading: readIO.loading,
        hasChanges: pendingIO.hasChanges,
        isValid: !userPropertyFields.warnings,
        save,
        cancel: pendingIO.reset,
        saving: pendingIO.saving,
        saveError: pendingIO.error,
    };
};

type Props = {
    data: UserPropertyFields;
    canCreate: boolean;
};

export function UserPropertiesTable({
    data: collection,
    canCreate,
    createField,
    updateField,
    deleteField,
    reorderField,
}: Props & FieldActions) {
    const {formatMessage} = useIntl();
    const data = collectionToArray(collection);

    const autoFillActiveRef = useRef<Set<string>>(new Set());
    const nameOverridesRef = useRef<Record<string, string>>({});
    const [, forceNameUpdate] = useState(0);

    const computeAutoFillSlug = useCallback((displayName: string): string | null => {
        let slug = slugifyForCEL(displayName);

        // slugifyForCEL returns '_copy' when the input normalizes to empty;
        // treat that as "nothing to auto-fill" rather than writing '_copy'
        // into the Name field.
        if (slug === '_copy' || CPA_FIELD_NAME_RESERVED_WORDS.has(slug)) {
            return null;
        }
        const runes = [...slug];
        if (runes.length > Constants.MAX_CUSTOM_ATTRIBUTE_NAME_LENGTH) {
            slug = runes.slice(0, Constants.MAX_CUSTOM_ATTRIBUTE_NAME_LENGTH).join('');
        }
        return slug;
    }, []);

    const handleDisplayNameChange = useCallback((rowId: string, value: string) => {
        if (!autoFillActiveRef.current.has(rowId)) {
            return;
        }
        const slug = computeAutoFillSlug(value);
        if (slug === null) {
            return;
        }
        if (nameOverridesRef.current[rowId] !== slug) {
            nameOverridesRef.current = {...nameOverridesRef.current, [rowId]: slug};
            forceNameUpdate((n) => n + 1);
        }
    }, [computeAutoFillSlug]);

    // Returns the auto-filled name slug if auto-fill is active for this row,
    // or null if auto-fill is inactive or the slug is invalid/reserved.
    const getAutoFillSlug = useCallback((rowId: string, displayNameValue: string): string | null => {
        if (!autoFillActiveRef.current.has(rowId)) {
            return null;
        }
        return computeAutoFillSlug(displayNameValue);
    }, [computeAutoFillSlug]);

    // This callback only fires from manual user edits to the Name <input> (the
    // DOM onChange event). Auto-fill updates via liveValue → useEffect → setValue
    // bypass the onChange handler entirely, so this comparison is always between
    // what the user manually typed and the expected slug derived from the
    // *committed* display_name. This invariant is what makes the deactivation
    // check correct — do not refactor liveValue to go through onChange.
    const handleNameChange = useCallback((rowId: string, value: string, currentField: UserPropertyField) => {
        const displayName = currentField.attrs?.display_name ?? '';
        const expectedSlug = slugifyForCEL(displayName);
        if (value !== expectedSlug) {
            autoFillActiveRef.current.delete(rowId);
            if (Object.prototype.hasOwnProperty.call(nameOverridesRef.current, rowId)) {
                const next = {...nameOverridesRef.current};
                Reflect.deleteProperty(next, rowId);
                nameOverridesRef.current = next;
            }
        }
    }, []);

    // Activate auto-fill for newly created pending rows with empty names
    useEffect(() => {
        for (const field of data) {
            if (isCreatePending(field) && field.name === '' && !autoFillActiveRef.current.has(field.id)) {
                autoFillActiveRef.current.add(field.id);
            }
        }
    }, [data]);

    const columns = useMemo<Array<ColumnDef<UserPropertyField, any>>>(() => {
        return [
            columnHelper.accessor((row) => row.attrs?.display_name ?? '', {
                id: 'display_name',
                size: 200,
                header: () => (
                    <ColHeaderLeft>
                        <FormattedMessage
                            id='admin.system_properties.user_properties.table.display_name_header'
                            defaultMessage='Display Name'
                        />
                    </ColHeaderLeft>
                ),
                cell: ({getValue, row}) => {
                    const toDelete = row.original.delete_at !== 0;
                    const isProtected = Boolean(row.original.attrs?.protected);

                    return (
                        <EditCell
                            strong={true}
                            value={getValue()}
                            label={formatMessage({
                                id: 'admin.system_properties.user_properties.table.display_name.input.label',
                                defaultMessage: 'Display Name',
                            })}
                            testid='property-display-name-input'
                            deleted={toDelete}
                            disabled={isProtected}
                            maxLength={Constants.MAX_CUSTOM_ATTRIBUTE_NAME_LENGTH}
                            autoFocus={isCreatePending(row.original) && !supportsOptions(row.original)}
                            onChange={(value: string) => {
                                handleDisplayNameChange(row.original.id, value);
                            }}
                            setValue={(value: string) => {
                                const slug = getAutoFillSlug(row.original.id, value);
                                updateField({
                                    ...row.original,
                                    ...(slug === null ? {} : {name: slug}),
                                    attrs: {
                                        ...row.original.attrs,
                                        display_name: value.trim() || undefined,
                                    },
                                });
                            }}
                        />
                    );
                },
                enableHiding: false,
                enableSorting: false,
            }),
            columnHelper.accessor('name', {
                size: 180,
                header: () => {
                    return (
                        <ColHeaderLeft>
                            <NameHeaderLabel>
                                <FormattedMessage
                                    id='admin.system_properties.user_properties.table.name'
                                    defaultMessage='Name'
                                />
                                <WithTooltip
                                    title={formatMessage({
                                        id: 'admin.system_properties.user_properties.table.identifier.tooltip',
                                        defaultMessage: 'Common Expression Language (CEL) identifier used in policies. Only letters, digits, and underscores allowed. Must start with a letter or underscore. Reserved CEL words are not allowed.',
                                    })}
                                >
                                    <InfoIconWrapper>
                                        <InformationOutlineIcon size={14}/>
                                    </InfoIconWrapper>
                                </WithTooltip>
                            </NameHeaderLabel>
                        </ColHeaderLeft>
                    );
                },
                cell: ({getValue, row}) => {
                    const toDelete = row.original.delete_at !== 0;
                    const isProtected = Boolean(row.original.attrs?.protected);
                    const warningId = collection.warnings?.[row.original.id]?.name;
                    const hasError = Boolean(warningId) && !toDelete;

                    return (
                        <NameCellWrapper $hasError={hasError}>
                            <EditCell
                                value={getValue()}
                                liveValue={nameOverridesRef.current[row.original.id]}
                                label={formatMessage({id: 'admin.system_properties.user_properties.table.property_name.input.name', defaultMessage: 'Attribute Name'})}
                                deleted={toDelete}
                                disabled={isProtected}
                                testid='property-field-input'
                                sanitize={filterCELIdentifier}
                                onChange={(value: string) => {
                                    handleNameChange(row.original.id, value, row.original);
                                }}
                                setValue={(value: string) => {
                                    updateField({...row.original, name: value.trim()});
                                }}
                                maxLength={Constants.MAX_CUSTOM_ATTRIBUTE_NAME_LENGTH}
                            />
                            {hasError && (
                                <NameCellErrorIcon
                                    data-testid='property-field-validation-error'
                                    aria-hidden='true'
                                >
                                    <AlertOutlineIcon size={14}/>
                                </NameCellErrorIcon>
                            )}
                        </NameCellWrapper>
                    );
                },
                enableHiding: false,
                enableSorting: false,
            }),
            columnHelper.accessor('type', {
                size: 100,
                header: () => {
                    return (
                        <ColHeaderLeft>
                            <FormattedMessage
                                id='admin.system_properties.user_properties.table.type'
                                defaultMessage='Type'
                            />
                        </ColHeaderLeft>
                    );
                },
                cell: ({row}) => {
                    return (
                        <SelectType
                            field={row.original}
                            updateField={updateField}
                        />
                    );
                },
                enableHiding: false,
                enableSorting: false,
            }),
            columnHelper.display({
                id: 'options',
                size: 300,
                header: () => (
                    <ColHeaderLeft>
                        <FormattedMessage
                            id='admin.system_properties.user_properties.table.values'
                            defaultMessage='Values'
                        />
                    </ColHeaderLeft>
                ),
                cell: ({row}) => (
                    <>
                        <UserPropertyValues
                            field={row.original}
                            updateField={updateField}
                            autoFocus={isCreatePending(row.original) && supportsOptions(row.original)}
                        />
                    </>
                ),
                enableHiding: false,
                enableSorting: false,
            }),
            columnHelper.display({
                id: 'actions',
                size: 40,
                header: () => {
                    return (
                        <ColHeaderRight>
                            <FormattedMessage
                                id='admin.system_properties.user_properties.table.actions'
                                defaultMessage='Actions'
                            />
                        </ColHeaderRight>
                    );
                },
                cell: ({row}) => {
                    return (
                        <ActionsCell
                            field={row.original}
                            canCreate={canCreate}
                            createField={createField}
                            updateField={updateField}
                            deleteField={deleteField}
                        />
                    );
                },
                enableHiding: false,
                enableSorting: false,
            }),
        ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [createField, updateField, deleteField, collection.warnings, canCreate, handleDisplayNameChange, getAutoFillSlug, handleNameChange, formatMessage]);

    const table = useReactTable<UserPropertyField>({
        data,
        columns,
        getCoreRowModel: getCoreRowModel<UserPropertyField>(),
        getSortedRowModel: getSortedRowModel<UserPropertyField>(),
        enableSortingRemoval: false,
        enableMultiSort: false,
        renderFallbackValue: '',
        meta: {
            tableId: 'userProperties',
            disablePaginationControls: true,
            onReorder: (prev: number, next: number) => {
                reorderField(collection.data[collection.order[prev]], next);
            },
        },
        manualPagination: true,
    });

    return (
        <TableWrapper>
            <AdminConsoleListTable<UserPropertyField> table={table}/>
        </TableWrapper>
    );
}

const TableWrapper = styled.div`
    table.adminConsoleListTable {

        td, th {
            &:after, &:before {
                display: none;
            }
        }

        thead {
            border-top: none;
            border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
            tr {
                th.pinned {
                    background: rgba(var(--center-channel-color-rgb), 0.04);
                    padding-block-end: 8px;
                    padding-block-start: 8px;
                }
            }
        }

        tbody {
            tr {
                border-top: none;
                border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
                border-bottom-color: rgba(var(--center-channel-color-rgb), 0.08) !important;
                td {
                    padding-block-end: 0;
                    padding-block-start: 0;

                    &:not(:first-child):not(:last-child) {
                        padding-inline-end: 0;
                        padding-inline-start: 0;
                    }

                    &:last-child {
                        padding-inline-end: 12px;
                    }
                    &.pinned {
                        background: none;
                    }
                }
            }
        }

        tfoot {
            border-top: none;
        }
    }
    .adminConsoleListTableContainer {
        padding: 2px 0px;
    }
`;

const ColHeaderLeft = styled.div`
    display: inline-block;
`;

const ColHeaderRight = styled.div`
    display: inline-block;
    width: 100%;
    text-align: right;
`;

const NameHeaderLabel = styled.span`
    display: inline-flex;
    align-items: center;
    gap: 4px;
`;

const InfoIconWrapper = styled.span`
    display: inline-flex;
    align-items: center;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    cursor: pointer;
`;

const NameCellWrapper = styled.div<{$hasError: boolean}>`
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
    height: 100%;

    ${({$hasError}) => $hasError && css`
        background: rgba(var(--error-text-color-rgb), 0.08);

        /* Reserve room for the absolutely-positioned error icon so long
           identifiers don't slide underneath it. */
        input {
            padding-right: 28px;
        }
    `};
`;

const NameCellErrorIcon = styled.span`
    position: absolute;
    top: 50%;
    right: 8px;
    display: inline-flex;
    align-items: center;
    color: var(--error-text);
    pointer-events: none;
    transform: translateY(-50%);
`;

const ValidationBannersWrapper = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 12px;
`;

const ActionsRoot = styled.div`
    text-align: right;
`;

type ActionsCellProps = {
    field: UserPropertyField;
    canCreate: boolean;
    createField: (field: UserPropertyField) => void;
    updateField: (field: UserPropertyField) => void;
    deleteField: (id: string) => void;
};

const ActionsCell = ({field, canCreate, createField, updateField, deleteField}: ActionsCellProps) => {
    const isOrphaned = useIsFieldOrphaned(field);

    return (
        <ActionsRoot>
            {isOrphaned ? (
                <OrphanedFieldDeleteButton
                    field={field}
                    deleteField={deleteField}
                />
            ) : (
                <DotMenu
                    field={field}
                    canCreate={canCreate}
                    createField={createField}
                    updateField={updateField}
                    deleteField={deleteField}
                />
            )}
        </ActionsRoot>
    );
};

type EditCellProps = {
    value: string;
    liveValue?: string;
    label?: string;
    testid?: string;
    setValue: (value: string) => void;
    onChange?: (value: string) => void;
    sanitize?: (value: string) => string;
    autoFocus?: boolean;
    disabled?: boolean;
    deleted?: boolean;
    footer?: ReactNode;
    strong?: boolean;
    maxLength?: number;
};
const EditCell = (props: EditCellProps) => {
    const [value, setValue] = useState(props.value);

    useEffect(() => {
        setValue(props.value);
    }, [props.value]);

    useEffect(() => {
        if (props.liveValue !== undefined) {
            setValue(props.liveValue);
        }
    }, [props.liveValue]);

    return (
        <>
            <BorderlessInput
                type='text'
                aria-label={props.label}
                data-testid={props.testid}
                disabled={props.disabled || props.deleted}
                $deleted={props.deleted}
                $strong={props.strong}
                maxLength={props.maxLength}
                autoFocus={props.autoFocus}
                onFocus={(e: React.FocusEvent<HTMLInputElement>) => {
                    if (props.autoFocus) {
                        e.target.select();
                    }
                }}
                value={value}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    let next = e.target.value;
                    if (props.sanitize) {
                        next = props.sanitize(next);
                    }
                    setValue(next);
                    props.onChange?.(next);
                }}
                onBlur={() => {
                    if (value !== props.value) {
                        props.setValue(value);
                    }
                }}
            />
            {props.footer}
        </>
    );
};

const nameBannerTitles = defineMessages({
    [ValidationWarningNameRequired]: {
        id: 'admin.system_properties.user_properties.table.validation.name_required',
        defaultMessage: 'Please enter an attribute name.',
    },
    [ValidationWarningNameUnique]: {
        id: 'admin.system_properties.user_properties.table.validation.name_unique',
        defaultMessage: 'Attribute names must be unique.',
    },
    [ValidationWarningNameTaken]: {
        id: 'admin.system_properties.user_properties.table.validation.name_taken',
        defaultMessage: 'Attribute name already taken.',
    },
    [ValidationWarningNameInvalidCEL]: {
        id: 'admin.system_properties.user_properties.table.validation.name_invalid_cel',
        defaultMessage: 'Identifier must start with a letter or underscore and contain only letters, numbers, and underscores. Reserved CEL words are not allowed.',
    },
});

const nameBannerBodies = defineMessages({
    [ValidationWarningNameRequired]: {
        id: 'admin.system_properties.user_properties.table.validation.banner.name_required',
        defaultMessage: '{count, plural, one {# attribute is} other {# attributes are}} missing a Name. Enter a Name to continue.',
    },
    [ValidationWarningNameUnique]: {
        id: 'admin.system_properties.user_properties.table.validation.banner.name_unique',
        defaultMessage: '{count, plural, one {# attribute shares} other {# attributes share}} the same Name. Update the highlighted Names so each attribute has a unique identifier.',
    },
    [ValidationWarningNameTaken]: {
        id: 'admin.system_properties.user_properties.table.validation.banner.name_taken',
        defaultMessage: 'The highlighted Name is already used by another attribute. Choose a different Name to continue.',
    },
    [ValidationWarningNameInvalidCEL]: {
        id: 'admin.system_properties.user_properties.table.validation.banner.name_invalid_cel',
        defaultMessage: 'The highlighted Name is not a valid identifier. Use letters, numbers, and underscores only; start with a letter or underscore, and avoid reserved CEL words.',
    },
});

const NAME_BANNER_ORDER = [
    ValidationWarningNameRequired,
    ValidationWarningNameInvalidCEL,
    ValidationWarningNameUnique,
    ValidationWarningNameTaken,
] as const;

type ValidationBannersProps = {
    warnings: UserPropertyFields['warnings'];
};

export const ValidationBanners = ({warnings}: ValidationBannersProps) => {
    const {counts, presentTypes} = useMemo(() => {
        const acc: Partial<Record<typeof NAME_BANNER_ORDER[number], number>> = {};
        if (warnings) {
            for (const warning of Object.values(warnings)) {
                const id = warning?.name;
                if (id && id in nameBannerTitles) {
                    const key = id as typeof NAME_BANNER_ORDER[number];
                    acc[key] = (acc[key] ?? 0) + 1;
                }
            }
        }
        return {
            counts: acc,
            presentTypes: NAME_BANNER_ORDER.filter((id) => (acc[id] ?? 0) > 0),
        };
    }, [warnings]);

    if (presentTypes.length === 0) {
        return null;
    }

    return (
        <ValidationBannersWrapper>
            {presentTypes.map((id) => (
                <AlertBanner
                    key={id}
                    mode='warning'
                    title={<FormattedMessage {...nameBannerTitles[id]}/>}
                    message={
                        <FormattedMessage
                            {...nameBannerBodies[id]}
                            values={{count: counts[id]}}
                        />
                    }
                />
            ))}
        </ValidationBannersWrapper>
    );
};
