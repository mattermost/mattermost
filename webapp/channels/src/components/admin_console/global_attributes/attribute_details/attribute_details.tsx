// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {IntlShape} from 'react-intl';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {ClientError} from '@mattermost/client';
import {buttonClassNames} from '@mattermost/shared/components/button';
import type {PropertyField, PropertyFieldOption} from '@mattermost/types/properties';
import {supportsOptions} from '@mattermost/types/properties';

import {setNavigationBlocked} from 'actions/admin_actions';

import BlockableLink from 'components/admin_console/blockable_link';
import {findRankCollision, isValidRank} from 'components/admin_console/system_properties/rank_utils';
import Card from 'components/card/card';
import * as Menu from 'components/menu';
import SaveButton from 'components/save_button';
import AdminHeader from 'components/widgets/admin_console/admin_header';
import Input from 'components/widgets/inputs/input/input';

import {getHistory} from 'utils/browser_history';
import Constants from 'utils/constants';
import {CPA_FIELD_NAME_MAX_RUNES, filterCELIdentifier, slugifyForCEL, validateCPAFieldName} from 'utils/properties';
import type {CPAFieldNameValidationError} from 'utils/properties';

import AttributeAppliesTo from './attribute_applies_to';
import {ALL_RESOURCE_TYPES, ATTRIBUTE_APPLIES_TO_ADD_HEADER_TRIGGER_ID, resourceTypeLabels} from './attribute_applies_to_constants';
import type {ResourceObjectType} from './attribute_applies_to_constants';
import AttributeExternalSource from './attribute_external_source';
import type {ExternalSource} from './attribute_external_source';
import AttributeOptionsRankValues from './attribute_options_rank_values';
import AttributeOptionsValues from './attribute_options_values';

import {getTypeIcon, getTypeLabel, typeLabels} from '../global_attributes_table';
import type {AttributeFieldType} from '../utils';
import {createAttributeField, createLinkedAttributeField, deleteAttributeField, deleteLinkedAttributeField} from '../utils';

import './attribute_details.scss';

const ALL_TYPES: AttributeFieldType[] = ['text', 'select', 'multiselect', 'rank'];
const LIST_ROUTE = '/admin_console/system_attributes/manage_attributes';

// Whether any option in `options` has a name equal to another option's name.
// Used defensively by canSave -- both options editors already block this
// interactively at add/rename time, but canSave re-derives it rather than
// trusting "the UI wouldn't let this happen" (matches the same defensive
// pattern used for rank validity below).
function hasDuplicateOptionNames(options: PropertyFieldOption[]): boolean {
    const seen = new Set<string>();
    for (const option of options) {
        if (seen.has(option.name)) {
            return true;
        }
        seen.add(option.name);
    }
    return false;
}

// Whether every option in `options` has a valid (positive, unique) rank.
// Only meaningful when the current type is 'rank'.
function hasValidRanks(options: PropertyFieldOption[]): boolean {
    return options.every((option, index) => isValidRank(option.rank) && !findRankCollision(options, option.rank as number, index));
}

// Single source of truth for this page's own route, so the "New attribute"
// button in global_attributes.tsx doesn't hardcode a second copy of this path.
export const ATTRIBUTE_DETAILS_ROUTE = `${LIST_ROUTE}/attribute_details`;

// Mirrors CPA's own computeAutoFillSlug guard (user_properties_table.tsx): a
// derived slug of '_copy' (slugifyForCEL's empty-input sentinel) means there is
// nothing meaningful to show yet. Unlike CPA, a slug that resolves to a reserved
// word is NOT hidden here -- it is surfaced (with an inline error) rather than
// silently suppressed, so the admin can see and fix the collision before Save.
function computeAutoSlugDisplay(displayName: string): string | null {
    if (displayName.trim().length === 0) {
        return null;
    }
    const slug = slugifyForCEL(displayName);
    return slug === '_copy' ? null : slug;
}

type ErrorKind =
    | 'name_conflict' |
    'invalid_charset' |
    'reserved_word' |
    'limit_reached' |
    'invalid_options' |
    'generic' |
    'applies_to_failed' |
    'applies_to_rollback_failed' |
    'applies_to_name_conflict' |
    'applies_to_limit_reached';

function errorKindFromError(error: unknown): ErrorKind {
    const serverErrorId = (error as ClientError | undefined)?.server_error_id;
    switch (serverErrorId) {
    case 'app.property_field.create.name_conflict.app_error':
        return 'name_conflict';
    case 'model.cpa_field.name.invalid_charset.app_error':
        return 'invalid_charset';
    case 'model.cpa_field.name.reserved_word.app_error':
        return 'reserved_word';
    case 'app.property_field.create.limit_reached.app_error':
    case 'app.property_field.create.group_limit_reached.app_error':
        return 'limit_reached';
    case 'app.property_field.invalid_attrs.app_error':
        return 'invalid_options';
    default:
        return 'generic';
    }
}

// A linked-field creation failure gets its own mapping rather than reusing
// errorKindFromError's cases above: the server error ids are identical to the
// template's own name-conflict/limit-reached ids (both write into the same
// access_control group), but the actionable copy is different -- a linked
// 'user'-object-type field conflicts with a Custom Profile Attributes field,
// not with another Global Attribute (see the plan's CPA-namespace-overlap
// Decision). Returns null for anything else, so the caller falls back to the
// generic applies-to-failed message.
function appliesToErrorKindFromError(error: unknown): 'applies_to_name_conflict' | 'applies_to_limit_reached' | null {
    const serverErrorId = (error as ClientError | undefined)?.server_error_id;
    switch (serverErrorId) {
    case 'app.property_field.create.name_conflict.app_error':
        return 'applies_to_name_conflict';
    case 'app.property_field.create.limit_reached.app_error':
    case 'app.property_field.create.group_limit_reached.app_error':
        return 'applies_to_limit_reached';
    default:
        return null;
    }
}

// Formats a resource-type list for interpolation into an error banner, e.g.
// "Users, Channels" -- reuses the same labels the picker and rows already
// show, so the banner names resources the same way the UI does.
function resourceTypeListLabel(types: ResourceObjectType[], formatMessage: IntlShape['formatMessage']): string {
    return types.map((type) => formatMessage(resourceTypeLabels[type])).join(', ');
}

// The settled result of a handleSave attempt -- computed synchronously
// through the create-or-rollback sequence, then applied in one place
// (finalizeSave) behind the single isMountedRef check (see Decisions).
type SaveOutcome =
    | {success: true} |
    {success: false; errorKind: ErrorKind; serverErrorMessage: string | null; failedResourceTypes: ResourceObjectType[] | null};

// Rolls back everything created in a failed handleSave attempt: deletes every
// linked field already created so far (continuing through the full list even
// if one delete fails, so a single stuck field doesn't leave the rest
// orphaned too), then -- only if every one of those deletes succeeded --
// attempts to delete the template itself (deletion-order protection
// guarantees the template delete would 409 otherwise, so it's skipped rather
// than attempted for a failure this banner can't explain). Returns the
// settled failure outcome for handleSave to hand to finalizeSave.
async function rollbackLinkedFields(
    createdLinkedFields: Array<{type: ResourceObjectType; field: PropertyField}>,
    templateFieldId: string,
    failedType: ResourceObjectType,
    creationError: unknown,
): Promise<SaveOutcome & {success: false}> {
    const survivingTypes: ResourceObjectType[] = [];
    for (const created of createdLinkedFields) {
        try {
            // eslint-disable-next-line no-await-in-loop
            await deleteLinkedAttributeField(created.type, created.field.id);
        } catch {
            survivingTypes.push(created.type);
        }
    }

    if (survivingTypes.length > 0) {
        return {
            success: false,
            errorKind: 'applies_to_rollback_failed',
            serverErrorMessage: null,
            failedResourceTypes: survivingTypes,
        };
    }

    try {
        await deleteAttributeField(templateFieldId);
    } catch (deleteTemplateError) {
        // Every linked field was rolled back, but the template itself
        // couldn't be deleted -- nothing more can be done client-side, and
        // there's no dedicated banner for this narrower case (see the plan's
        // Decisions table), so it falls through to the same outcome as a
        // clean rollback below. Logged so this isn't a fully silent failure:
        // a retry will surface the leftover template as a name_conflict,
        // which this log at least gives a paper trail for.
        // eslint-disable-next-line no-console
        console.error('Failed to delete orphaned attribute template after rolling back its linked fields', deleteTemplateError);
    }

    const cpaErrorKind = appliesToErrorKindFromError(creationError);
    return {
        success: false,
        errorKind: cpaErrorKind ?? 'applies_to_failed',
        serverErrorMessage: null,
        failedResourceTypes: [failedType],
    };
}

function nameErrorMessage(error: CPAFieldNameValidationError, formatMessage: IntlShape['formatMessage']): string {
    if (error.kind === 'reserved_word') {
        return formatMessage(nameErrorMessages.reservedWord, {word: error.word});
    }
    if (error.kind === 'too_long') {
        return formatMessage(nameErrorMessages.tooLong, {max: error.max});
    }
    return formatMessage(nameErrorMessages.invalidCharset);
}

type Props = {
    disabled?: boolean;
};

function AttributeDetails({disabled = false}: Props): JSX.Element {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();

    const [displayName, setDisplayName] = useState('');
    const [manualName, setManualName] = useState('');

    // Whether the admin currently has a committed manual override -- once true,
    // the Name stops re-deriving from Display name on further edits (persists
    // even if isEditingName below is later toggled back off). Can revert back
    // to false if Done is clicked while the field was left empty and there was
    // no prior commit -- see handleDoneClick. Also doubles as the pre-edit-
    // session snapshot handleDoneClick needs: it cannot change while
    // isEditingName is true (the Edit button that would flip it isn't even
    // rendered then), so reading it live at Done-click time is equivalent to,
    // and simpler than, capturing a separate ref at Edit-click time.
    const [isNameManuallyEdited, setIsNameManuallyEdited] = useState(false);

    // Whether the input is CURRENTLY shown/focused -- toggled independently by
    // the Edit/Done link.
    const [isEditingName, setIsEditingName] = useState(false);

    // The pre-edit-session Name, captured when "Edit" is clicked, so "Done" can
    // restore it if the field is left empty on a session that already had a
    // committed override (see handleDoneClick).
    const previousManualNameRef = useRef('');

    // Type and Options are independent state -- switching type never clears
    // options (see Design Decision 3 in the plan): a Text -> Select -> Text ->
    // Select round-trip must restore whatever the admin already entered.
    const [fieldType, setFieldType] = useState<AttributeFieldType>('text');
    const [options, setOptions] = useState<PropertyFieldOption[]>([]);

    // Independent of fieldType/options -- both may be set at once (mirrors
    // CPA's own dot-menu, which lets an admin link both AD/LDAP and SAML on
    // the same field). See attribute_external_source.tsx.
    const [ldapAttr, setLdapAttr] = useState('');
    const [samlAttr, setSamlAttr] = useState('');

    // Pending Applies-to selection -- insertion order, not fixed Users/Channels/
    // Posts order (that fixed order only governs the picker's own offer list).
    const [appliesTo, setAppliesTo] = useState<ResourceObjectType[]>([]);

    const [saving, setSaving] = useState(false);
    const [errorKind, setErrorKind] = useState<ErrorKind | null>(null);

    // Only populated for the applies_to_* error kinds -- interpolated into
    // their banners to name which resource(s) failed to create (generic
    // failure) or which survived a failed rollback (rollback-failed banner).
    const [failedResourceTypes, setFailedResourceTypes] = useState<ResourceObjectType[] | null>(null);

    // Only populated for 'name_conflict' -- the server's own message names the
    // specific conflicting field and the level it conflicts at (e.g. "system"),
    // which the canned copy below can't express since it doesn't know that detail.
    // Other kinds keep the canned copy: e.g. invalid_attrs's server message
    // ("Invalid property field attributes.") is less specific than ours.
    const [serverErrorMessage, setServerErrorMessage] = useState<string | null>(null);

    // Guards the post-await side effects in handleSave below against firing
    // after the component has unmounted (e.g. the admin confirmed "leave
    // without saving" via the BlockableLink prompt while a request was still
    // in flight) -- without this, a slow save that resolves after the user has
    // already navigated elsewhere would force-navigate them back to the list.
    const isMountedRef = useRef(true);
    useEffect(() => () => {
        isMountedRef.current = false;
    }, []);

    const autoSlugDisplay = useMemo(() => computeAutoSlugDisplay(displayName), [displayName]);
    const currentName = (isEditingName || isNameManuallyEdited) ? manualName : (autoSlugDisplay ?? '');
    const nameValidationError = currentName ? validateCPAFieldName(currentName) : null;

    // Kept as a primitive rather than passing nameValidationError itself into
    // handleDoneClick's dep array -- the error object is rebuilt on every
    // render while invalid, which would churn the callback identity needlessly.
    const hasNameError = Boolean(nameValidationError);

    // Display name was typed but auto-derivation produced nothing usable (e.g.
    // a non-Latin-script or symbol-only Display name normalizes to slugifyForCEL's
    // empty-input sentinel) -- distinct from nameValidationError (which requires
    // a non-empty currentName) and from the untouched-form empty state, so it
    // needs its own explanation rather than a silently-disabled Save button.
    const autoSlugCollapsedToEmpty = !isEditingName && !isNameManuallyEdited &&
        Boolean(displayName.trim()) && autoSlugDisplay === null;

    // Done refuses to commit an invalid Name (see handleDoneClick). Surfaced as
    // aria-disabled rather than the disabled attribute so the button stays
    // focusable -- a keyboard user who tabs to it still lands on it and hears
    // the reason via aria-describedby, instead of it silently vanishing from
    // the tab order with no explanation.
    const isDoneBlocked = isEditingName && hasNameError;

    const isServerNameError = errorKind === 'name_conflict' || errorKind === 'reserved_word' || errorKind === 'invalid_charset';
    let nameDescribedBy: string | undefined;
    if (nameValidationError) {
        nameDescribedBy = 'attribute-unique-name-error';
    } else if (isServerNameError) {
        nameDescribedBy = 'attribute-save-error';
    }

    const markDirty = useCallback(() => {
        dispatch(setNavigationBlocked(true));
        setErrorKind(null);
        setServerErrorMessage(null);
        setFailedResourceTypes(null);
    }, [dispatch]);

    // Defensive dedupe, independent of the picker's own filtering (which
    // already only offers not-yet-selected types) -- a genuine no-op if the
    // type is somehow already present, so it doesn't mark the page dirty or
    // clear an error banner for nothing.
    const handleAdd = useCallback((type: ResourceObjectType) => {
        if (appliesTo.includes(type)) {
            return;
        }
        setAppliesTo((prev) => [...prev, type]);
        markDirty();
    }, [appliesTo, markDirty]);

    const handleRemove = useCallback((type: ResourceObjectType) => {
        setAppliesTo((prev) => prev.filter((existing) => existing !== type));
        markDirty();
    }, [markDirty]);

    // Moves focus to the header Add-resource trigger after a pre-save removal
    // (see the plan's Decisions table) -- via useEffect, not directly inside
    // handleRemove, since the trigger may have just been re-rendered into
    // existence this same update (e.g. removing the 3rd of 3 selected types
    // un-hides both triggers), and a synchronous focus() call in the handler
    // would run before that re-render commits. Mirrors the sibling external-
    // source picker's own prevCountRef pattern (attribute_external_source.tsx).
    //
    // Also handles the mirror-image case on add: picking the 3rd (last)
    // resource type unmounts BOTH "Add resource" triggers in this same
    // render, including whichever one the admin just clicked -- MUI's
    // Popover restores focus to that trigger once its close transition
    // finishes, but the trigger is gone from the DOM by then, so focus
    // silently drops to <body> with no fix here. Landing on the
    // just-added row's own toggle keeps focus on a real, newly-rendered
    // element instead. Looked up by data-testid (not id) since the row
    // doesn't otherwise need a stable element id.
    const prevAppliesToLengthRef = useRef(appliesTo.length);
    useEffect(() => {
        const prevLength = prevAppliesToLengthRef.current;
        if (appliesTo.length < prevLength) {
            document.getElementById(ATTRIBUTE_APPLIES_TO_ADD_HEADER_TRIGGER_ID)?.focus();
        } else if (appliesTo.length > prevLength && appliesTo.length === ALL_RESOURCE_TYPES.length) {
            const lastAddedType = appliesTo[appliesTo.length - 1];
            document.querySelector<HTMLElement>(`[data-testid="attributeAppliesToRow-${lastAddedType}-toggle"]`)?.focus();
        }
        prevAppliesToLengthRef.current = appliesTo.length;
    }, [appliesTo]);

    // Switching into Rank from any other type (re)assigns rank = index + 1 to
    // every current option, overwriting any stale rank values -- mirrors CPA's
    // own handleTypeChange (user_properties_type_menu.tsx) exactly, and is
    // idempotent. Switching away from Rank leaves rank values sitting inert in
    // state (not stripped) -- harmless, since Select/Multiselect ignore it.
    const handleTypeChange = useCallback((newType: AttributeFieldType) => {
        if (newType === fieldType) {
            return;
        }
        markDirty();
        if (newType === 'rank' && fieldType !== 'rank') {
            setOptions((prevOptions) => (prevOptions.length > 0 ? prevOptions.map((option, index) => ({...option, rank: index + 1})) : prevOptions));
        }

        // The server unconditionally strips attrs.ldap/attrs.saml from any
        // non-Text field on save (AccessControlAttributeValidationHook) --
        // clear both proactively here so the UI never shows a link that's
        // about to silently vanish.
        if (newType !== 'text') {
            setLdapAttr('');
            setSamlAttr('');
        }
        setFieldType(newType);
    }, [fieldType, markDirty]);

    const handleOptionsChange = useCallback((newOptions: PropertyFieldOption[]) => {
        markDirty();
        setOptions(newOptions);
    }, [markDirty]);

    // Shared by both the "add" trigger (value: newly typed attribute name)
    // and a chip's remove action (value: ''). A no-op (unchanged value) skips
    // both the state update and markDirty(), mirroring handleTypeChange's own
    // no-op guard above.
    const handleLink = useCallback((source: ExternalSource, rawValue: string) => {
        const value = rawValue.trim();
        const current = source === 'ldap' ? ldapAttr : samlAttr;
        if (value === current) {
            return;
        }
        markDirty();
        if (source === 'ldap') {
            setLdapAttr(value);
        } else {
            setSamlAttr(value);
        }
        if (value) {
            setFieldType('text');
        }
    }, [ldapAttr, samlAttr, markDirty]);

    const handleDisplayNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setDisplayName(e.target.value);
        markDirty();
    }, [markDirty]);

    const handleEditClick = useCallback(() => {
        previousManualNameRef.current = isNameManuallyEdited ? manualName : '';
        setManualName((current) => (isNameManuallyEdited ? current : (autoSlugDisplay ?? '')));
        setIsEditingName(true);
    }, [autoSlugDisplay, isNameManuallyEdited, manualName]);

    // Done, Enter, and blur (clicking away) share this path. Inert while the
    // typed Name is invalid, so a reserved word or bad charset can never be
    // committed -- the admin must fix it first. This is not a focus trap:
    // clearing the field makes Done live again (an empty name has no
    // validation error, and Done then applies the revert rules below), and
    // Escape still discards the whole edit outright.
    const handleDoneClick = useCallback(() => {
        if (hasNameError) {
            return;
        }
        if (manualName === '') {
            if (isNameManuallyEdited) {
                setManualName(previousManualNameRef.current);
            } else {
                setIsNameManuallyEdited(false);
            }
        } else {
            setIsNameManuallyEdited(manualName !== (autoSlugDisplay ?? ''));
        }
        setIsEditingName(false);
    }, [hasNameError, manualName, isNameManuallyEdited, autoSlugDisplay]);

    const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setManualName(filterCELIdentifier(e.target.value));
        markDirty();
    }, [markDirty]);

    // Escape discards whatever was typed this session and exits edit mode,
    // as distinct from Done (which commits it -- see handleDoneClick).
    // Deliberately NOT gated on hasNameError: Escape is the unconditional way
    // out of an edit session, including one left in an invalid state.
    const handleCancelEdit = useCallback(() => {
        setManualName(previousManualNameRef.current);
        setIsEditingName(false);
    }, []);

    const handleNameKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleDoneClick();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleCancelEdit();
        }
    }, [handleDoneClick, handleCancelEdit]);

    const hasExternalSource = Boolean(ldapAttr || samlAttr);
    const typeSupportsOptions = supportsOptions({type: fieldType} as PropertyField);

    // Defensive re-check, not the primary guard: both options editors already
    // block duplicate names and invalid/duplicate ranks interactively at
    // add/rename time (see attribute_options_values.tsx /
    // attribute_options_rank_values.tsx), so 'duplicate'/'invalid_rank' should
    // never actually be the reason Save is disabled in normal use -- computed
    // here (and memoized against [typeSupportsOptions, options, fieldType], so
    // an unrelated re-render like a display-name keystroke doesn't re-walk the
    // options array) so there's still a specific inline reason to show if they
    // ever are.
    const optionsIssue = useMemo(() => {
        if (!typeSupportsOptions) {
            return null;
        }
        if (options.length === 0) {
            return 'required' as const;
        }
        if (hasDuplicateOptionNames(options)) {
            return 'duplicate' as const;
        }
        if (fieldType === 'rank' && !hasValidRanks(options)) {
            return 'invalid_rank' as const;
        }
        return null;
    }, [typeSupportsOptions, options, fieldType]);

    const canSave = !disabled && Boolean(displayName.trim()) && Boolean(currentName) && !nameValidationError && !saving && optionsIssue === null;

    // Applies the fully-settled outcome of a save attempt -- the ONLY place in
    // handleSave that reads isMountedRef, checked once after the entire
    // create-or-rollback sequence below has finished (see the plan's Decisions
    // table: inserting a mounted-check earlier, e.g. right after the template
    // create, would skip the linked-field loop and its rollback entirely if
    // the admin navigated away mid-save, leaving an orphaned template with no
    // cleanup attempted).
    const finalizeSave = useCallback((outcome: SaveOutcome) => {
        if (!isMountedRef.current) {
            return;
        }
        if (outcome.success) {
            dispatch(setNavigationBlocked(false));
            getHistory().push(LIST_ROUTE);
            return;
        }
        setErrorKind(outcome.errorKind);
        setServerErrorMessage(outcome.serverErrorMessage);
        setFailedResourceTypes(outcome.failedResourceTypes);
        setSaving(false);
    }, [dispatch]);

    const handleSave = useCallback(async () => {
        if (!canSave) {
            return;
        }
        setSaving(true);
        setErrorKind(null);
        setServerErrorMessage(null);
        setFailedResourceTypes(null);

        let templateField: PropertyField;
        try {
            templateField = await createAttributeField(displayName, currentName, fieldType, options, {ldapAttr, samlAttr});
        } catch (error) {
            finalizeSave({
                success: false,
                errorKind: errorKindFromError(error),
                serverErrorMessage: (error as ClientError | undefined)?.message ?? null,
                failedResourceTypes: null,
            });
            return;
        }

        // Serial, not Promise.all -- costs nothing at N<=3 calls and is what
        // makes "which resource failed" deterministic (see Decisions).
        const createdLinkedFields: Array<{type: ResourceObjectType; field: PropertyField}> = [];
        let outcome: SaveOutcome = {success: true};

        for (const type of appliesTo) {
            try {
                // eslint-disable-next-line no-await-in-loop
                const linkedField = await createLinkedAttributeField(type, currentName, fieldType, displayName, templateField.id);
                createdLinkedFields.push({type, field: linkedField});
            } catch (error) {
                // eslint-disable-next-line no-await-in-loop
                outcome = await rollbackLinkedFields(createdLinkedFields, templateField.id, type, error);
                break;
            }
        }

        finalizeSave(outcome);
    }, [canSave, displayName, currentName, fieldType, options, ldapAttr, samlAttr, appliesTo, finalizeSave]);

    const TypeIcon = getTypeIcon(fieldType);

    // The two applies_to_* kinds below that interpolate resource names need
    // their own copy path -- they can't go through the flat
    // formatMessage(errorMessages[errorKind]) call every other kind uses,
    // since that call takes no values. applies_to_name_conflict and
    // applies_to_limit_reached use canned copy naming the actual cause
    // ("already used by a User Attribute") rather than the server's raw
    // message -- unlike the template's own name_conflict case below (which
    // reuses the server's message because it already names the specific
    // conflicting field/level), the server's generic name-conflict message
    // has no notion of "User Attribute" to say, since that framing is
    // specific to this feature's CPA-namespace overlap.
    let errorContent: React.ReactNode = null;
    if (errorKind === 'applies_to_failed') {
        errorContent = formatMessage(errorMessages.applies_to_failed, {resources: resourceTypeListLabel(failedResourceTypes ?? [], formatMessage)});
    } else if (errorKind === 'applies_to_rollback_failed') {
        errorContent = formatMessage(errorMessages.applies_to_rollback_failed, {
            name: displayName,
            resources: resourceTypeListLabel(failedResourceTypes ?? [], formatMessage),
        });
    } else if (errorKind === 'name_conflict' && serverErrorMessage) {
        errorContent = serverErrorMessage;
    } else if (errorKind) {
        errorContent = formatMessage(errorMessages[errorKind]);
    }

    return (
        <div
            className='wrapper--fixed AttributeDetails'
            data-testid='attributeDetails'
        >
            <AdminHeader withBackButton={true}>
                <div>
                    <BlockableLink
                        to={LIST_ROUTE}
                        className='fa fa-angle-left back'
                        aria-label={formatMessage(messages.backLink)}
                        data-testid='attributeDetailsBackLink'
                    />
                    <hgroup className='AttributeDetails__headerGroup'>
                        <FormattedMessage
                            tagName='h1'
                            {...messages.title}
                        />
                        <FormattedMessage
                            tagName='p'
                            {...messages.subtitle}
                        />
                    </hgroup>
                </div>
            </AdminHeader>
            <div className='admin-console__wrapper'>
                <div className='admin-console__content'>
                    <Card
                        expanded={true}
                        disableExpandAnimation={true}
                        className='console'
                    >
                        <Card.Header>
                            <div className='AttributeDetails__headerGroup'>
                                <div className='AttributeDetails__blockTitle'>
                                    <FormattedMessage {...messages.definitionTitle}/>
                                </div>
                                <FormattedMessage
                                    tagName='p'
                                    {...messages.definitionSubtitle}
                                />
                            </div>
                        </Card.Header>
                        <Card.Body expanded={true}>
                            <div className='AttributeDetails__row'>
                                <label
                                    className='AttributeDetails__label'
                                    htmlFor='input_display_name'
                                >
                                    <FormattedMessage {...messages.displayNameLabel}/>
                                </label>
                                <div className='AttributeDetails__fieldControl'>
                                    <Input
                                        name='display_name'
                                        type='text'
                                        useLegend={false}
                                        placeholder={formatMessage(messages.displayNamePlaceholder)}
                                        aria-label={formatMessage(messages.displayNameLabel)}
                                        value={displayName}
                                        onChange={handleDisplayNameChange}
                                        autoFocus={true}
                                        disabled={saving || disabled}
                                        maxLength={Constants.MAX_CUSTOM_ATTRIBUTE_NAME_LENGTH}
                                        data-testid='attributeDisplayNameInput'
                                    />
                                    <div className='AttributeDetails__uniqueName'>
                                        <span
                                            className='AttributeDetails__uniqueNameCaption'
                                            aria-live='polite'
                                            data-testid='attributeUniqueNameCaption'
                                        >
                                            <span
                                                className='AttributeDetails__uniqueNamePrefix'
                                                id='attribute-unique-name-prefix'
                                            >
                                                <FormattedMessage {...messages.uniqueNamePrefix}/>
                                            </span>
                                            {isEditingName ? (
                                                <input
                                                    type='text'
                                                    className={classNames('AttributeDetails__uniqueNameInput', {
                                                        'AttributeDetails__uniqueNameInput--error': Boolean(nameValidationError) || isServerNameError,
                                                    })}
                                                    value={manualName}
                                                    onChange={handleNameChange}
                                                    onKeyDown={handleNameKeyDown}
                                                    onBlur={handleDoneClick}
                                                    autoFocus={true}
                                                    disabled={saving || disabled}
                                                    maxLength={CPA_FIELD_NAME_MAX_RUNES}
                                                    aria-labelledby='attribute-unique-name-prefix'
                                                    aria-describedby={nameDescribedBy}
                                                    aria-invalid={Boolean(nameValidationError) || isServerNameError}
                                                    data-testid='attributeNameInput'
                                                />
                                            ) : (
                                                <span
                                                    className={classNames({'AttributeDetails__uniqueNameValue--error': Boolean(nameValidationError) || isServerNameError})}
                                                    aria-describedby={nameDescribedBy}
                                                    data-testid='attributeUniqueNameValue'
                                                >
                                                    {isNameManuallyEdited ? manualName : (autoSlugDisplay ?? '—')}
                                                </span>
                                            )}
                                            <button
                                                type='button'
                                                className='AttributeDetails__editLink'
                                                onClick={isEditingName ? handleDoneClick : handleEditClick}
                                                onMouseDown={(e) => {
                                                    // Blur runs before click. Without this, Done would
                                                    // commit on blur and the same click would re-open Edit.
                                                    if (isEditingName) {
                                                        e.preventDefault();
                                                    }
                                                }}
                                                disabled={saving || disabled}
                                                aria-disabled={isDoneBlocked || undefined}
                                                aria-describedby={isDoneBlocked ? 'attribute-unique-name-error' : undefined}
                                                aria-label={formatMessage(isEditingName ? messages.doneLinkAriaLabel : messages.editLinkAriaLabel)}
                                                data-testid='attributeNameEditLink'
                                            >
                                                <FormattedMessage {...(isEditingName ? messages.doneLink : messages.editLink)}/>
                                            </button>
                                        </span>
                                        {nameValidationError && (
                                            <div
                                                id='attribute-unique-name-error'
                                                className='AttributeDetails__uniqueNameError'
                                                role='alert'
                                                data-testid='attributeUniqueNameError'
                                            >
                                                {nameErrorMessage(nameValidationError, formatMessage)}
                                            </div>
                                        )}
                                        {autoSlugCollapsedToEmpty && (
                                            <div
                                                id='attribute-unique-name-empty-warning'
                                                className='AttributeDetails__uniqueNameError'
                                                role='alert'
                                                data-testid='attributeUniqueNameEmptyWarning'
                                            >
                                                <FormattedMessage {...messages.couldNotGenerateName}/>
                                            </div>
                                        )}
                                        <p className='AttributeDetails__helperText'>
                                            <FormattedMessage {...messages.helperText}/>
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className='AttributeDetails__row'>
                                <span
                                    className='AttributeDetails__label'
                                    data-testid='attributeTypeLabel'
                                >
                                    <FormattedMessage {...messages.typeLabel}/>
                                </span>
                                <div className='AttributeDetails__fieldControl'>
                                    <Menu.Container
                                        menuButton={{
                                            id: 'attribute-type-menu-button',
                                            class: 'AttributeDetails__typeButton',
                                            disabled: saving || disabled || hasExternalSource,
                                            'aria-label': hasExternalSource ? formatMessage(messages.typeFieldLockedAriaLabel) : formatMessage(messages.typeFieldAriaLabel, {value: formatMessage(getTypeLabel(fieldType))}),
                                            children: (
                                                <>
                                                    <span className='AttributeDetails__typeButtonInner'>
                                                        <TypeIcon size={18}/>
                                                        <FormattedMessage {...getTypeLabel(fieldType)}/>
                                                    </span>
                                                    {!hasExternalSource && (
                                                        <i className='icon icon-chevron-down'/>
                                                    )}
                                                </>
                                            ),
                                            dataTestId: 'attributeTypeMenuButton',
                                        }}
                                        menu={{
                                            id: 'attribute-type-menu',
                                            'aria-label': formatMessage(messages.typeMenuAriaLabel),
                                        }}
                                    >
                                        {ALL_TYPES.map((optionFieldType) => {
                                            const ItemIcon = getTypeIcon(optionFieldType);
                                            const isCurrentType = optionFieldType === fieldType;

                                            return (
                                                <Menu.Item
                                                    id={`attribute-type-${optionFieldType}`}
                                                    key={optionFieldType}
                                                    role='menuitemradio'
                                                    forceCloseOnSelect={true}
                                                    aria-checked={isCurrentType}
                                                    onClick={() => handleTypeChange(optionFieldType)}
                                                    leadingElement={<ItemIcon size={18}/>}
                                                    labels={<FormattedMessage {...typeLabels[optionFieldType]}/>}
                                                />
                                            );
                                        })}
                                    </Menu.Container>
                                </div>
                            </div>
                            <div className='AttributeDetails__row'>
                                <span
                                    className='AttributeDetails__label'
                                    data-testid='attributeOptionsLabel'
                                >
                                    <FormattedMessage {...messages.optionsLabel}/>
                                </span>
                                <div className='AttributeDetails__fieldControl'>
                                    {typeSupportsOptions ? (
                                        <>
                                            {fieldType === 'rank' ? (
                                                <AttributeOptionsRankValues
                                                    options={options}
                                                    onOptionsChange={handleOptionsChange}
                                                    disabled={saving || disabled}
                                                />
                                            ) : (
                                                <AttributeOptionsValues
                                                    options={options}
                                                    onOptionsChange={handleOptionsChange}
                                                    disabled={saving || disabled}
                                                />
                                            )}
                                            {optionsIssue && (
                                                <div
                                                    className='AttributeDetails__uniqueNameError'
                                                    role='alert'
                                                    data-testid='attributeOptionsRequiredError'
                                                >
                                                    <FormattedMessage {...(optionsIssue === 'required' ? messages.optionsRequired : messages.optionsInvalid)}/>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        !hasExternalSource && (
                                            <p
                                                className='AttributeDetails__optionsHelp'
                                                data-testid='attributeOptionsHelp'
                                            >
                                                <FormattedMessage {...messages.optionsHelp}/>
                                            </p>
                                        )
                                    )}
                                    <AttributeExternalSource
                                        ldapAttr={ldapAttr}
                                        samlAttr={samlAttr}
                                        fieldType={fieldType}
                                        onLink={handleLink}
                                        disabled={saving || disabled}
                                    />
                                </div>
                            </div>
                        </Card.Body>
                    </Card>
                    <AttributeAppliesTo
                        appliesTo={appliesTo}
                        disabled={saving || disabled}
                        onAdd={handleAdd}
                        onRemove={handleRemove}
                    />
                </div>
            </div>
            <div className='admin-console-save'>
                <SaveButton
                    disabled={!canSave}
                    saving={saving}
                    onClick={handleSave}
                    defaultMessage={<FormattedMessage {...messages.save}/>}
                />
                <BlockableLink
                    className={buttonClassNames({emphasis: 'quaternary'})}
                    to={LIST_ROUTE}
                    data-testid='attributeCancelLink'
                >
                    <FormattedMessage {...messages.cancel}/>
                </BlockableLink>
                {errorKind && (
                    <span
                        id='attribute-save-error'
                        className='AttributeDetails__error'
                        role='alert'
                        data-testid='attributeSaveError'
                    >
                        <i className='icon icon-alert-outline'/>
                        {errorContent}
                    </span>
                )}
            </div>
        </div>
    );
}

export default AttributeDetails;

const messages = defineMessages({
    backLink: {id: 'admin.global_attributes.attribute_details.back_link', defaultMessage: 'Back to Manage Attributes'},
    title: {id: 'admin.global_attributes.attribute_details.title', defaultMessage: 'New attribute'},
    subtitle: {id: 'admin.global_attributes.attribute_details.subtitle', defaultMessage: 'Add a display name, choose a type, and pick where it applies.'},
    definitionTitle: {id: 'admin.global_attributes.attribute_details.definition.title', defaultMessage: 'Definition'},
    definitionSubtitle: {id: 'admin.global_attributes.attribute_details.definition.subtitle', defaultMessage: 'Display name, type, and options.'},
    displayNameLabel: {id: 'admin.global_attributes.attribute_details.display_name.label', defaultMessage: 'Display name'},
    displayNamePlaceholder: {id: 'admin.global_attributes.attribute_details.display_name.placeholder', defaultMessage: 'Add a display name'},
    uniqueNamePrefix: {id: 'admin.global_attributes.attribute_details.unique_name.prefix', defaultMessage: 'Unique name:'},
    editLink: {id: 'admin.global_attributes.attribute_details.unique_name.edit', defaultMessage: 'Edit'},
    editLinkAriaLabel: {id: 'admin.global_attributes.attribute_details.unique_name.edit_aria_label', defaultMessage: 'Edit unique name'},
    doneLink: {id: 'admin.global_attributes.attribute_details.unique_name.done', defaultMessage: 'Done'},
    doneLinkAriaLabel: {id: 'admin.global_attributes.attribute_details.unique_name.done_aria_label', defaultMessage: 'Done editing unique name'},
    helperText: {
        id: 'admin.global_attributes.attribute_details.unique_name.helper_text',
        defaultMessage: 'Name is the internal identifier for policies and integrations. Display name is what admins and users see.',
    },
    couldNotGenerateName: {
        id: 'admin.global_attributes.attribute_details.unique_name.could_not_generate',
        defaultMessage: "Couldn't generate a unique name from this display name. Click Edit to set one manually.",
    },
    typeLabel: {id: 'admin.global_attributes.attribute_details.type.label', defaultMessage: 'Type'},
    typeMenuAriaLabel: {id: 'admin.global_attributes.attribute_details.type.menu_label', defaultMessage: 'Select type'},
    typeFieldAriaLabel: {id: 'admin.global_attributes.attribute_details.type.field_aria_label', defaultMessage: 'Type: {value}'},
    typeFieldLockedAriaLabel: {id: 'admin.global_attributes.attribute_details.type.field_locked_aria_label', defaultMessage: 'Type: Text. Locked while linked to an external source.'},
    optionsLabel: {id: 'admin.global_attributes.attribute_details.options.label', defaultMessage: 'Options'},
    optionsHelp: {
        id: 'admin.global_attributes.attribute_details.options.help',
        defaultMessage: 'Text attributes have no preset values — a value is typed in per resource.',
    },
    optionsRequired: {
        id: 'admin.global_attributes.attribute_details.options.required',
        defaultMessage: 'At least one option is required.',
    },
    optionsInvalid: {
        id: 'admin.global_attributes.attribute_details.options.invalid',
        defaultMessage: "There's a problem with one or more options — check for a duplicate or overly long name, or a missing/duplicate rank.",
    },
    save: {id: 'admin.global_attributes.attribute_details.save', defaultMessage: 'Save'},
    cancel: {id: 'admin.global_attributes.attribute_details.cancel', defaultMessage: 'Cancel'},
});

const nameErrorMessages = defineMessages({
    invalidCharset: {
        id: 'admin.global_attributes.attribute_details.name_error.invalid_charset',
        defaultMessage: 'Name must start with a letter or underscore, and contain only letters, numbers, and underscores.',
    },
    reservedWord: {
        id: 'admin.global_attributes.attribute_details.name_error.reserved_word',
        defaultMessage: '"{word}" is a reserved word and cannot be used as a name.',
    },
    tooLong: {
        id: 'admin.global_attributes.attribute_details.name_error.too_long',
        defaultMessage: 'Name must be {max} characters or fewer.',
    },
});

const errorMessages = defineMessages({
    name_conflict: {
        id: 'admin.global_attributes.attribute_details.save_error.name_conflict',
        defaultMessage: 'An attribute with this name already exists. Please choose a different name.',
    },
    invalid_charset: {
        id: 'admin.global_attributes.attribute_details.save_error.invalid_charset',
        defaultMessage: 'Name must start with a letter or underscore, and contain only letters, numbers, and underscores.',
    },
    reserved_word: {
        id: 'admin.global_attributes.attribute_details.save_error.reserved_word',
        defaultMessage: 'This name is a reserved word and cannot be used. Please choose a different name.',
    },
    limit_reached: {
        id: 'admin.global_attributes.attribute_details.save_error.limit_reached',
        defaultMessage: 'You have reached the maximum number of attributes for this server. Delete an existing attribute before creating a new one.',
    },
    invalid_options: {
        id: 'admin.global_attributes.attribute_details.save_error.invalid_options',
        defaultMessage: "There's a problem with one or more options — check for a duplicate or overly long name, or a missing/duplicate rank, then try again.",
    },
    generic: {
        id: 'admin.global_attributes.attribute_details.save_error.generic',
        defaultMessage: 'Something went wrong while saving this attribute. Please try again.',
    },
    applies_to_failed: {
        id: 'admin.global_attributes.attribute_details.save_error.applies_to_failed',
        defaultMessage: "Couldn't apply this attribute to {resources}. Nothing was saved — please try again.",
    },
    applies_to_rollback_failed: {
        id: 'admin.global_attributes.attribute_details.save_error.applies_to_rollback_failed',
        defaultMessage: '"{name}" may have been partially created for {resources}. A retry under the same name will likely fail until those are cleaned up.',
    },
    applies_to_name_conflict: {
        id: 'admin.global_attributes.attribute_details.save_error.applies_to_name_conflict',
        defaultMessage: 'This name is already used by a User Attribute. Please choose a different name.',
    },
    applies_to_limit_reached: {
        id: 'admin.global_attributes.attribute_details.save_error.applies_to_limit_reached',
        defaultMessage: 'The maximum number of User Attributes has been reached. Delete an existing one before applying this attribute to Users.',
    },
});
