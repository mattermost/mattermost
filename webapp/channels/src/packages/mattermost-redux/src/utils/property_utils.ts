// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyChangePolicy, PropertyField, PropertyFieldOption, PropertyRestrictionLevel, PropertyRestrictions} from '@mattermost/types/properties';

// The identity sources a user attribute can be synced from, in the order the
// server resolves them (model.GetPropertyFieldSyncSource). Each names the
// external attribute or claim under the attr of the same name, and is also the
// auth_service of the users it signs in.
export const PROPERTY_SYNC_SOURCES = ['ldap', 'saml', 'openid'] as const;

export type PropertySyncSource = typeof PROPERTY_SYNC_SOURCES[number];

// The sources a field is linked to, in PROPERTY_SYNC_SOURCES order.
export function getPropertyFieldSyncSources(field: Pick<PropertyField, 'attrs'>): PropertySyncSource[] {
    return PROPERTY_SYNC_SOURCES.filter((source) => isSyncMapping(field.attrs?.[source]));
}

// Whether an identity source writes the field's values, which no session user
// -- sysadmin included -- may then set.
export function isPropertyFieldSynced(field: Pick<PropertyField, 'attrs'>): boolean {
    return getPropertyFieldSyncSources(field).length > 0;
}

// Whether the field is synced from the source the user signs in with, so the
// value shown is the one the user's login provider sends.
export function isPropertyFieldSyncedForAuthService(field: Pick<PropertyField, 'attrs'>, authService: string | undefined): boolean {
    return getPropertyFieldSyncSources(field).some((source) => source === authService);
}

// Returns true if the field uses the legacy PSAv1 schema.
// Legacy properties have an empty object_type and rely on simple target_id
// uniqueness, rather than the hierarchical uniqueness model used by PSAv2.
export function isPSAv1PropertyField(field: PropertyField): boolean {
    return !field.object_type;
}

// Anything non-boolean predates the server-side validation of this key; treat it
// as not required rather than guessing.
export function isPropertyFieldRequired(field: PropertyField): boolean {
    return field.attrs?.required === true;
}

// Mirrors model.GetPropertyFieldChangePolicy: change_policy wins, an explicit
// editable=false reads as "never" so fields written before the key keep their
// behaviour, and anything unrecognised falls back to the permissive default.
export function getPropertyFieldChangePolicy(field: PropertyField): PropertyChangePolicy {
    const policy = field.attrs?.change_policy;
    if (policy === 'never' || policy === 'raise_only' || policy === 'lower_only' || policy === 'any') {
        return policy;
    }
    if (field.attrs?.editable === false) {
        return 'never';
    }
    return 'any';
}

// Absent means editable, so fields created before the key existed do not read as
// locked.
export function isPropertyFieldEditable(field: PropertyField): boolean {
    return getPropertyFieldChangePolicy(field) !== 'never';
}

/**
 * Whether a field's values are written by an integration rather than by people,
 * so no session user -- sysadmin included -- may set them.
 *
 * Mirrors all three refusals in checkValueWriteAccess on the server: an
 * attrs.owners list hands the values to the listed owners, attrs.protected
 * reserves them for the plugin in attrs.source_plugin_id (only a plugin can set
 * either key), and a mapping under a sync source's attr (attrs.ldap, attrs.saml
 * or attrs.openid) reserves them for that sync service. None of them consults permission_values -- the write is refused
 * before that tier is reached.
 */
export function isPropertyFieldSourceManaged(field: PropertyField): boolean {
    const attrs = field.attrs;
    if (!attrs) {
        return false;
    }
    if (attrs.protected === true) {
        return true;
    }
    if (Array.isArray(attrs.owners) && attrs.owners.length > 0) {
        return true;
    }
    return isPropertyFieldSynced(field);
}

// GetPropertyFieldSyncSource reads these as strings, so anything else is not a
// mapping the sync service would recognise either.
function isSyncMapping(mapping: unknown): boolean {
    return typeof mapping === 'string' && mapping !== '';
}

// Whether a stored value counts as set. Mirrors isEmptyPropertyValue on the
// server: null, an empty string and an empty list all read as "Not set".
export function isPropertyValueSet(raw: unknown): boolean {
    if (raw === null || raw === undefined || raw === '') {
        return false;
    }
    return !(Array.isArray(raw) && raw.length === 0);
}

// A field's option list, or an empty one. attrs is loosely typed, so every
// caller would otherwise repeat the same cast; an absent list and an empty list
// are not distinguishable on the wire, so both read as empty here.
export function getPropertyFieldOptions(field: PropertyField): PropertyFieldOption[] {
    return (field.attrs?.options as PropertyFieldOption[] | undefined) ?? [];
}

// Only a stored rank counts. The server refuses a rank field whose options lack
// one and fails closed when a change-policy check meets one, so no position is
// invented here either; such options can only come from a stale cache.
function getStoredRank(option: PropertyFieldOption): number | undefined {
    return typeof option.rank === 'number' ? option.rank : undefined;
}

export function getOptionRank(field: PropertyField, optionId: string): number | undefined {
    const option = getPropertyFieldOptions(field).find((candidate) => candidate.id === optionId);
    return option ? getStoredRank(option) : undefined;
}

// Highest rank first; unranked options last. Equal ranks keep their stored order.
export function sortOptionsByRank<T extends PropertyFieldOption>(options: readonly T[]): T[] {
    const rankOf = (option: T) => getStoredRank(option) ?? -Infinity;

    return [...options].sort((a, b) => {
        const rankA = rankOf(a);
        const rankB = rankOf(b);
        if (rankA === rankB) {
            return 0;
        }
        return rankB > rankA ? 1 : -1;
    });
}

/**
 * Whether the field's change policy permits moving from its current value to the
 * given option. Higher rank is higher, matching the server.
 *
 * An unset value may move anywhere: the policy governs changes, not the first
 * write. A rank that cannot be resolved on either side fails closed, since an
 * unresolvable comparison on a marking must not read as permitted.
 */
export function canMoveToOption(field: PropertyField, currentValue: unknown, optionId: string): boolean {
    if (!isPropertyValueSet(currentValue)) {
        return true;
    }

    const policy = getPropertyFieldChangePolicy(field);
    if (policy === 'any') {
        return true;
    }
    if (policy === 'never') {
        return false;
    }

    const currentId = typeof currentValue === 'string' ? currentValue : undefined;
    if (!currentId) {
        return false;
    }

    const currentRank = getOptionRank(field, currentId);
    const nextRank = getOptionRank(field, optionId);
    if (currentRank === undefined || nextRank === undefined) {
        return false;
    }

    return policy === 'raise_only' ? nextRank > currentRank : nextRank < currentRank;
}

// Classification Markings stores its unique name as this lowercase slug and
// does not write display_name. User-facing surfaces should match the admin
// heading ("Classification"), not the slug.
const CLASSIFICATION_FIELD_NAME = 'classification';

// Title-cases an internal name so it reads as a heading. Also used directly by
// the Manage Attributes page, which renders a field's slug as a page heading.
export function formatPropertyFieldLabel(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) {
        return trimmed;
    }
    return trimmed.charAt(0).toLocaleUpperCase() + trimmed.slice(1);
}

// display_name is the admin-facing override; name is the CEL-safe slug fallback.
/**
 * Orders fields by attrs.sort_order ascending, then name. Ties break on name, not
 * create_at: chip order is something people are told to read, so it must follow
 * the configuration rather than insertion timing. The name compare uses a fixed
 * locale; the default is the viewer's, which would order equal-ranked chips
 * differently per user. Names are ASCII slugs, so this is total.
 */
export function comparePropertyFieldOrder(a: PropertyField, b: PropertyField): number {
    const rankA = typeof a.attrs?.sort_order === 'number' ? a.attrs.sort_order : Number.MAX_SAFE_INTEGER;
    const rankB = typeof b.attrs?.sort_order === 'number' ? b.attrs.sort_order : Number.MAX_SAFE_INTEGER;
    if (rankA !== rankB) {
        return rankA - rankB;
    }
    return a.name.localeCompare(b.name, 'en');
}

export function getPropertyFieldLabel(field: PropertyField): string {
    const displayName = field.attrs?.display_name;
    const raw = typeof displayName === 'string' && displayName ? displayName : field.name;
    if (field.name === CLASSIFICATION_FIELD_NAME) {
        return formatPropertyFieldLabel(raw);
    }
    return raw;
}

// Reads at member or everyone are visible to every member of a channel.
function isReadableByMembers(level: PropertyRestrictionLevel | undefined): boolean {
    return level === 'member' || level === 'everyone';
}

// The restrictions the server enforces for the field: permissions.restrictions
// when present, otherwise the conversion of the legacy permission_* keys and
// attrs (model.PermissionsFromLegacy). A nil permission_values is the channel
// default, admin.
function getEffectiveRestrictions(field: PropertyField): {restrictions: PropertyRestrictions; masked: boolean} {
    if (field.permissions) {
        return {restrictions: field.permissions.restrictions ?? {}, masked: Boolean(field.permissions.masking)};
    }

    const accessMode = field.attrs?.access_mode;
    let read: PropertyRestrictionLevel = 'none';
    if (accessMode === undefined || accessMode === '' || accessMode === 'public' || accessMode === 'shared_only') {
        read = 'everyone';
    }

    const sourceManaged = isPropertyFieldSourceManaged(field);
    let valueWrite: PropertyRestrictionLevel = field.permission_values ?? 'admin';
    if (sourceManaged) {
        valueWrite = 'none';
    }
    const protectedField = field.protected === true || field.attrs?.protected === true;
    const fieldWrite: PropertyRestrictionLevel = protectedField ? 'none' : (field.permission_field || 'none');
    const optionWrite: PropertyRestrictionLevel = field.attrs?.protected === true ? 'none' : (field.permission_options || 'none');

    return {
        restrictions: {
            value: {read, write: valueWrite || 'none'},
            option: {read, write: optionWrite},
            field: {write: fieldWrite},
        },
        masked: accessMode === 'shared_only',
    };
}

function isManagedByAdmin(field: PropertyField): boolean {
    return field.attrs?.managed === 'admin';
}

// Mirrors model.IsChannelFieldFillableByCreators: whoever creates a channel can
// give it a value for the field only when value.write is admin (the creator
// becomes the channel's admin) or member, and members can read the field's
// options and values. A required field failing this can never be satisfied by a
// new channel.
export function isChannelFieldFillableByCreators(field: PropertyField): boolean {
    if (field.object_type !== 'channel' || isManagedByAdmin(field)) {
        return false;
    }

    const {restrictions, masked} = getEffectiveRestrictions(field);
    if (masked) {
        return false;
    }

    const write = restrictions.value?.write;
    return (write === 'admin' || write === 'member') &&
        isReadableByMembers(restrictions.value?.read) &&
        isReadableByMembers(restrictions.option?.read);
}

// Whether the only thing keeping creators from filling the field is its
// value.write tier (sysadmin or none), so moving that tier to admin fixes it.
// Admin-managed, source-managed, masked and unreadable fields need more than that.
export function isChannelFieldLevelOnlyUnfillable(field: PropertyField): boolean {
    if (field.object_type !== 'channel' || isManagedByAdmin(field) || isPropertyFieldSourceManaged(field)) {
        return false;
    }

    const {restrictions, masked} = getEffectiveRestrictions(field);
    if (masked || !isReadableByMembers(restrictions.value?.read) || !isReadableByMembers(restrictions.option?.read)) {
        return false;
    }

    // Any tier but the two a creator can fill is fixed by moving it to admin.
    const write = restrictions.value?.write;
    return write !== 'admin' && write !== 'member';
}

// The restrictions to PATCH to let channel admins set the field's values. The
// server replaces restrictions wholesale, so the rest of the effective
// restrictions are carried over unchanged.
export function getRestrictionsWithChannelAdminValueWrite(field: PropertyField): PropertyRestrictions {
    const {restrictions} = getEffectiveRestrictions(field);
    return {
        ...restrictions,
        value: {...restrictions.value, write: 'admin'},
    };
}
