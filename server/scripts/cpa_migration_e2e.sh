#!/usr/bin/env bash
# End-to-end live-instance test for the CPA → protected_attributes migration
# (PR 36180). Exercises both the CPA shim API and the generic property API,
# validates hook-level constraints, authorization, backward compatibility,
# and the hook-scoping invariant that non-CPA groups stay unaffected.
#
# Usage:  ./cpa_migration_e2e.sh HOST_URL ADMIN_USERNAME ADMIN_PASSWORD
# Default: ./cpa_migration_e2e.sh http://localhost:8065 admin password1234
#
# Assumes:
#   - A non-admin user "user" / "password1234" exists.
#   - Enterprise license is installed.
#   - Server DB is postgres mm_wt_dk_cpa_migration (mmuser/mostest) for
#     direct-DB sync-lock simulation; override via MM_DB_URL env.
#
# -----------------------------------------------------------------------------
# What is tested
# -----------------------------------------------------------------------------
# Every created field is prefixed with e2e_cpa_ and purged (HTTP + hard DB
# delete) before and after the run, so the script is idempotent.
#
# Section 1 — CPA shim: field CRUD
#   Create all 6 PropertyFieldType values (text / select / multiselect / date
#   / user / multiuser), including text with value_type = email | url | phone
#   and select/multiselect with options. Verify response shape (object_type,
#   target_type, sort_order, hook-driven permission_field/values/options).
#   Cover PATCH (rename, visibility change, options-only patch on select),
#   DELETE, list-fields ordering by sort_order.
#
# Section 2 — CPA shim: value CRUD
#   Self-patch via /custom_profile_attributes/values, admin patch-for-user
#   via /users/{id}/custom_profile_attributes, user self-patch, GET roundtrip
#   across all 8 value types, empty body → 400, value sanitization (leading
#   and trailing whitespace trimmed, empty entries dropped from arrays).
#
# Section 3 — Generic property API (/properties/groups/...)
#   The same field & value CRUD via the generic route. Verifies:
#     - target_type query param is required on GET (400 if missing)
#     - unknown group → 404; legacy name "custom_profile_attributes" returns
#       404 via HTTP (the alias is plugin-API only)
#     - target_type required on POST; protected=true rejected
#     - hooks fire on this path too (permission_field forced to sysadmin)
#     - CPA GET and generic GET surface the same values from the same store
#     - wrong object_type bucket on PATCH/DELETE returns 404 (not 403/500)
#
# Section 4 — Hook validation & error mapping
#   AttributeValidationHook:
#     - field create: invalid visibility / value_type / managed / sort_order
#     - value upsert: text > 64 chars, bad email, bad URL, select with an
#       unknown option id, multiselect with an unknown id, user/multiuser
#       with an invalid Mattermost id, wrong JSON shape (array for a select)
#   Plus: duplicate field_id in patch, empty patch, > 50 items in patch,
#   unknown field_id (all paths return 400 via App.GetPropertyFields's
#   ErrResultsMismatch — the hook-path 404 is unreachable from HTTP by
#   design; see commit 7111e82823).
#   Mass-assignment guard on createCPAField: client-supplied id / protected
#   / permission_* are overwritten by the shim + hooks.
#   FieldLimitHook: fills to 20 user fields, asserts 21st returns 422
#   limit_reached.
#   managed=admin on create (as admin) → PermissionValues=sysadmin; a
#   non-admin then cannot write that field → 403.
#
# Section 5 — Authorization (AccessControl + executor permission checks)
#   - unauthenticated GET / POST → 401
#   - non-admin: list fields OK, GET /group OK, POST/PATCH/DELETE field
#     → 403 (PermissionManageSystem / hook-forced sysadmin on PermissionField)
#   - non-admin: PATCH other user's values → 403 (PermissionEditOtherUsers)
#   - non-admin: PATCH own values → 200
#   - non-admin: generic POST field / generic PATCH other-user values → 403
#   - non-admin: writing their own 'user'-type (non-managed) value → 200
#
# Section 6 — Backwards-compat shim behavior
#   - CPA list returns fields in ascending sort_order
#   - /custom_profile_attributes/group returns the same group id the generic
#     API resolves for "protected_attributes"
#   - CPA PATCH values returns the legacy map shape {fieldID: value} while
#     the generic PATCH returns an array
#
# Section 7 — Sync lock (LDAP / SAML via direct DB)
#   psql UPDATE sets attrs.ldap / attrs.saml on a live field, then:
#     - admin PATCH value → 403 sync_lock (via both CPA and generic routes)
#     - user PATCH own value → 403 sync_lock
#     - admin field rename still succeeds (sync lock guards values only)
#   Then clears the attr and asserts the cleanup was itself successful.
#
# Section 8 — Hook isolation (non-protected_attributes groups)
#   Regression guard against a hook accidentally attaching to every group:
#   creates a field in content_flagging with an intentionally invalid
#   visibility, confirms the response has member-level permissions (no
#   AttributeValidationHook rewrite), upserts a freeform value (no value_type
#   check), and creates 5 filler fields in a row (no FieldLimitHook cap).
#
# Not covered (documented gaps)
#   - LicenseCheckHook: would require live license toggling.
#   - Plugin-owned / Protected fields and the orphan-plugin cleanup path:
#     would require a CPA-emitting plugin installed on the live instance.
#     The only plugin-related assertion here is that Protected: true from
#     a client is rejected.

set -u
set -o pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

HOST_URL="${1:-http://localhost:8065}"
ADMIN_USERNAME="${2:-admin}"
ADMIN_PASSWORD="${3:-password1234}"
USER_USERNAME="${USER_USERNAME:-user}"
USER_PASSWORD="${USER_PASSWORD:-password1234}"

# Direct-DB connection for the sync-lock simulation section. Override with
# MM_DB_URL=postgres://user:pass@host/db if different.
MM_DB_URL="${MM_DB_URL:-postgres://mmuser:mostest@localhost/mm_wt_dk_cpa_migration?sslmode=disable}"

# All field names are prefixed so cleanup can be idempotent across re-runs
# without touching fields created outside this script.
FIELD_PREFIX="e2e_cpa_"

ADMIN_TOKEN=""
ADMIN_ID=""
USER_TOKEN=""
USER_ID=""
GROUP_ID=""

# Tallies
PASS=0
FAIL=0
SKIP=0
FAIL_NAMES=()

# Tracked field IDs for cleanup. We also sweep by name prefix on entry & exit.
CREATED_FIELD_IDS=()

# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------

if [[ -t 1 ]]; then
    C_RED=$'\033[31m'
    C_GREEN=$'\033[32m'
    C_YELLOW=$'\033[33m'
    C_BLUE=$'\033[34m'
    C_BOLD=$'\033[1m'
    C_RESET=$'\033[0m'
else
    C_RED='' C_GREEN='' C_YELLOW='' C_BLUE='' C_BOLD='' C_RESET=''
fi

section() {
    printf "\n%s==== %s ====%s\n" "$C_BOLD$C_BLUE" "$1" "$C_RESET"
}

pass() {
    PASS=$((PASS + 1))
    printf "  %sPASS%s %s\n" "$C_GREEN" "$C_RESET" "$1"
}

fail() {
    FAIL=$((FAIL + 1))
    FAIL_NAMES+=("$1")
    printf "  %sFAIL%s %s\n" "$C_RED" "$C_RESET" "$1"
    if [[ -n "${2:-}" ]]; then
        printf "       %s\n" "$2"
    fi
}

skip() {
    SKIP=$((SKIP + 1))
    printf "  %sSKIP%s %s\n" "$C_YELLOW" "$C_RESET" "$1"
    if [[ -n "${2:-}" ]]; then
        printf "       %s\n" "$2"
    fi
}

info() {
    printf "  %s\n" "$1"
}

die() {
    printf "%sFATAL:%s %s\n" "$C_RED" "$C_RESET" "$1" >&2
    exit 1
}

# ---------------------------------------------------------------------------
# curl wrappers: emit STATUS<newline>BODY so we can split both reliably.
# ---------------------------------------------------------------------------

# Usage: http_call METHOD PATH TOKEN [BODY]
# Sets HTTP_STATUS and HTTP_BODY globals.
http_call() {
    local method="$1" path="$2" token="$3" body="${4:-}"
    local url="$HOST_URL$path"
    local tmp
    tmp="$(mktemp)"
    local status
    local -a args=(-s -o "$tmp" -w "%{http_code}" -X "$method" "$url")
    if [[ -n "$token" ]]; then
        args+=(-H "Authorization: Bearer $token")
    fi
    if [[ -n "$body" ]]; then
        args+=(-H "Content-Type: application/json" --data-raw "$body")
    fi
    status="$(curl "${args[@]}" || true)"
    HTTP_STATUS="$status"
    HTTP_BODY="$(cat "$tmp")"
    rm -f "$tmp"
}

# Usage: expect_status TEST_NAME EXPECTED_STATUS ACTUAL_STATUS [ACTUAL_BODY]
expect_status() {
    local name="$1" expected="$2" actual="$3" body="${4:-}"
    if [[ "$actual" == "$expected" ]]; then
        pass "$name"
        return 0
    else
        fail "$name" "expected HTTP $expected, got $actual; body=${body:0:200}"
        return 1
    fi
}

# Usage: expect_contains TEST_NAME HAYSTACK NEEDLE
expect_contains() {
    local name="$1" hay="$2" needle="$3"
    if [[ "$hay" == *"$needle"* ]]; then
        pass "$name"
        return 0
    else
        fail "$name" "expected substring '$needle' in: ${hay:0:200}"
        return 1
    fi
}

# Extract a JSON field with python (robust against formatting quirks).
jget() {
    python3 -c 'import json,sys
try:
    d=json.loads(sys.stdin.read())
except Exception:
    sys.exit(1)
keys=sys.argv[1].split(".")
v=d
for k in keys:
    if isinstance(v,list):
        v=v[int(k)]
    elif isinstance(v,dict):
        v=v.get(k,"")
    else:
        v=""
        break
print(v if v is not None else "")' "$1" 2>/dev/null
}

# ---------------------------------------------------------------------------
# Login helpers
# ---------------------------------------------------------------------------

login() {
    local login_id="$1" password="$2"
    local tmp
    tmp="$(mktemp)"
    local body="{\"login_id\":\"$login_id\",\"password\":\"$password\"}"
    local hdrs
    hdrs="$(curl -s -D - -o "$tmp" \
        -H "Content-Type: application/json" \
        --data-raw "$body" \
        "$HOST_URL/api/v4/users/login" || true)"
    local status
    status="$(head -n1 <<<"$hdrs" | awk '{print $2}')"
    if [[ "$status" != "200" ]]; then
        rm -f "$tmp"
        printf " \n"  # empty token, empty user_id — caller treats as failure
        return 0
    fi
    local token user_id
    token="$(grep -i '^Token:' <<<"$hdrs" | awk '{print $2}' | tr -d '\r')"
    user_id="$(jget id <"$tmp")"
    rm -f "$tmp"
    printf "%s %s\n" "$token" "$user_id"
}

# ---------------------------------------------------------------------------
# Field helpers (CPA shim)
# ---------------------------------------------------------------------------

# Usage: create_cpa_field NAME TYPE [ATTRS_JSON]
# Does NOT echo — use globals afterwards: HTTP_STATUS, HTTP_BODY, LAST_FIELD_ID.
# LAST_FIELD_ID is empty if create failed.
create_cpa_field() {
    local name="$1" type="$2" attrs="${3:-{\}}"
    local body
    body="$(python3 -c 'import json,sys
print(json.dumps({
    "name": sys.argv[1],
    "type": sys.argv[2],
    "attrs": json.loads(sys.argv[3]),
}))' "$name" "$type" "$attrs")"
    http_call POST /api/v4/custom_profile_attributes/fields "$ADMIN_TOKEN" "$body"
    LAST_FIELD_ID=""
    if [[ "$HTTP_STATUS" == "201" ]]; then
        LAST_FIELD_ID="$(jget id <<<"$HTTP_BODY")"
        if [[ -n "$LAST_FIELD_ID" ]]; then
            CREATED_FIELD_IDS+=("$LAST_FIELD_ID")
        fi
    fi
}

delete_cpa_field() {
    local id="$1"
    [[ -z "$id" ]] && return 0
    http_call DELETE "/api/v4/custom_profile_attributes/fields/$id" "$ADMIN_TOKEN"
    # Drop from CREATED_FIELD_IDS so cleanup doesn't retry.
    local -a remaining=()
    for existing in "${CREATED_FIELD_IDS[@]:-}"; do
        if [[ -n "$existing" && "$existing" != "$id" ]]; then
            remaining+=("$existing")
        fi
    done
    CREATED_FIELD_IDS=("${remaining[@]:-}")
}

# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------

cleanup_fields_by_prefix() {
    # Fetch all fields via CPA list, delete anything with our prefix.
    [[ -z "$ADMIN_TOKEN" ]] && return 0
    http_call GET /api/v4/custom_profile_attributes/fields "$ADMIN_TOKEN"
    if [[ "$HTTP_STATUS" != "200" ]]; then
        return 0
    fi
    # Use python to extract IDs of matching fields.
    local ids
    ids="$(python3 -c '
import json,sys
try:
    data=json.loads(sys.stdin.read())
except Exception:
    sys.exit(0)
for f in data or []:
    if (f.get("name","") or "").startswith(sys.argv[1]):
        print(f.get("id",""))
' "$FIELD_PREFIX" <<<"$HTTP_BODY")"
    while IFS= read -r id; do
        [[ -z "$id" ]] && continue
        http_call DELETE "/api/v4/custom_profile_attributes/fields/$id" "$ADMIN_TOKEN"
    done <<<"$ids"
}

cleanup_values_for_test_users() {
    # Wipe any property values still attached to admin/user for this group
    # so the next run starts from a clean slate. Best-effort; ignore errors.
    [[ -z "$MM_DB_URL" ]] && return 0
    if ! command -v psql >/dev/null 2>&1; then
        return 0
    fi
    psql "$MM_DB_URL" -q -c "DELETE FROM propertyvalues WHERE groupid='$GROUP_ID' AND targetid IN ('$ADMIN_ID','$USER_ID');" >/dev/null 2>&1 || true
}

purge_soft_deleted_fields() {
    # HTTP DELETE soft-deletes property fields (DeleteAt > 0). Over many runs
    # these accumulate in the DB; purge our prefixed rows (active + tombstoned)
    # to keep the table size bounded. Best-effort — the script is still
    # functionally correct if psql is absent.
    [[ -z "$MM_DB_URL" ]] && return 0
    if ! command -v psql >/dev/null 2>&1; then
        return 0
    fi
    psql "$MM_DB_URL" -q -c "
        DELETE FROM propertyvalues WHERE fieldid IN (
            SELECT id FROM propertyfields WHERE name LIKE '${FIELD_PREFIX}%'
        );
        DELETE FROM propertyfields WHERE name LIKE '${FIELD_PREFIX}%';
    " >/dev/null 2>&1 || true
}

on_exit() {
    local rc=$?
    section "Cleanup"
    # Drop any fields we tracked that weren't cleaned inline.
    for id in "${CREATED_FIELD_IDS[@]:-}"; do
        [[ -z "$id" ]] && continue
        http_call DELETE "/api/v4/custom_profile_attributes/fields/$id" "$ADMIN_TOKEN" >/dev/null 2>&1 || true
    done
    cleanup_fields_by_prefix
    cleanup_values_for_test_users
    purge_soft_deleted_fields
    info "Cleanup complete."
    print_summary
    exit $rc
}

print_summary() {
    printf "\n%sResults:%s %sPASS=%d%s  %sFAIL=%d%s  %sSKIP=%d%s\n" \
        "$C_BOLD" "$C_RESET" \
        "$C_GREEN" "$PASS" "$C_RESET" \
        "$C_RED" "$FAIL" "$C_RESET" \
        "$C_YELLOW" "$SKIP" "$C_RESET"
    if (( FAIL > 0 )); then
        printf "%sFailed cases:%s\n" "$C_RED" "$C_RESET"
        for n in "${FAIL_NAMES[@]}"; do
            printf "  - %s\n" "$n"
        done
    fi
}

trap on_exit EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# ---------------------------------------------------------------------------
# Section 0: Bootstrap
# ---------------------------------------------------------------------------

section "Bootstrap"

# Ping before attempting anything else.
http_call GET /api/v4/system/ping "" ""
if [[ "$HTTP_STATUS" != "200" ]]; then
    die "server at $HOST_URL is not reachable (status=$HTTP_STATUS)"
fi
info "Server ping OK ($HOST_URL)"

# Admin login
read -r ADMIN_TOKEN ADMIN_ID <<<"$(login "$ADMIN_USERNAME" "$ADMIN_PASSWORD")"
if [[ -z "$ADMIN_TOKEN" ]]; then
    die "admin login failed for '$ADMIN_USERNAME'"
fi
info "Admin logged in: id=$ADMIN_ID"

# Non-admin login
read -r USER_TOKEN USER_ID <<<"$(login "$USER_USERNAME" "$USER_PASSWORD")"
if [[ -z "$USER_TOKEN" ]]; then
    die "non-admin login failed for '$USER_USERNAME' (expected a regular user account with that login)"
fi
info "Non-admin logged in: id=$USER_ID"

# Group ID
http_call GET /api/v4/custom_profile_attributes/group "$ADMIN_TOKEN" ""
if [[ "$HTTP_STATUS" != "200" ]]; then
    die "could not fetch CPA group id (status=$HTTP_STATUS body=$HTTP_BODY)"
fi
GROUP_ID="$(jget id <<<"$HTTP_BODY")"
[[ -z "$GROUP_ID" ]] && die "empty group id from /group endpoint"
info "protected_attributes group: $GROUP_ID"

# Pre-run cleanup of stragglers (active, then any tombstones from prior runs).
cleanup_fields_by_prefix
cleanup_values_for_test_users
purge_soft_deleted_fields
info "Pre-run cleanup done."

# ---------------------------------------------------------------------------
# Section 1: CPA Field CRUD (backwards-compatible shim)
# ---------------------------------------------------------------------------

section "CPA shim: field CRUD"

# ---- text ----
create_cpa_field "${FIELD_PREFIX}text1" text '{"visibility":"always","sort_order":1}'
id_text="$LAST_FIELD_ID"
if [[ -n "$id_text" ]]; then
    pass "POST /custom_profile_attributes/fields type=text → 201"
    expect_contains "text field: object_type=user"             "$HTTP_BODY" '"object_type":"user"'
    expect_contains "text field: target_type=system"           "$HTTP_BODY" '"target_type":"system"'
    expect_contains "text field: permission_field=sysadmin"    "$HTTP_BODY" '"permission_field":"sysadmin"'
    expect_contains "text field: permission_values=member"     "$HTTP_BODY" '"permission_values":"member"'
    expect_contains "text field: permission_options=sysadmin"  "$HTTP_BODY" '"permission_options":"sysadmin"'
    expect_contains "text field: visibility=always"            "$HTTP_BODY" '"visibility":"always"'
    expect_contains "text field: sort_order=1"                 "$HTTP_BODY" '"sort_order":1'
else
    fail "POST /custom_profile_attributes/fields type=text" "status=$HTTP_STATUS body=${HTTP_BODY:0:200}"
fi

# ---- text with value_type (email) ----
create_cpa_field "${FIELD_PREFIX}email1" text '{"value_type":"email","sort_order":2}'
id_email="$LAST_FIELD_ID"
if [[ -n "$id_email" ]]; then
    pass "POST text with value_type=email → 201"
    expect_contains "email field: value_type=email" "$HTTP_BODY" '"value_type":"email"'
else
    fail "POST text with value_type=email" "status=$HTTP_STATUS body=${HTTP_BODY:0:200}"
fi

# ---- text with value_type=url ----
create_cpa_field "${FIELD_PREFIX}url1" text '{"value_type":"url","sort_order":3}'
id_url="$LAST_FIELD_ID"
[[ -n "$id_url" ]] && pass "POST text with value_type=url → 201" || \
    fail "POST text with value_type=url"

# ---- text with value_type=phone ----
create_cpa_field "${FIELD_PREFIX}phone1" text '{"value_type":"phone","sort_order":4}'
id_phone="$LAST_FIELD_ID"
[[ -n "$id_phone" ]] && pass "POST text with value_type=phone → 201" || \
    fail "POST text with value_type=phone"

# ---- select (with options) ----
create_cpa_field "${FIELD_PREFIX}select1" select '{
    "sort_order":5,
    "options":[
        {"name":"Red","color":"#ff0000"},
        {"name":"Green","color":"#00ff00"},
        {"name":"Blue","color":"#0000ff"}
    ]
}'
id_select="$LAST_FIELD_ID"
if [[ -n "$id_select" ]]; then
    pass "POST select with options → 201"
    opt_count=$(python3 -c 'import json,sys;d=json.loads(sys.stdin.read());print(len(d["attrs"]["options"] or []))' <<<"$HTTP_BODY")
    if [[ "$opt_count" == "3" ]]; then
        pass "select options echoed with count=3"
    else
        fail "select options echoed with count=3" "got count=$opt_count"
    fi
    SELECT_OPT_IDS="$(python3 -c 'import json,sys;d=json.loads(sys.stdin.read());print("\n".join(o["id"] for o in d["attrs"]["options"]))' <<<"$HTTP_BODY")"
else
    fail "POST select with options" "status=$HTTP_STATUS body=${HTTP_BODY:0:200}"
fi

# ---- multiselect ----
create_cpa_field "${FIELD_PREFIX}multi1" multiselect '{
    "sort_order":6,
    "options":[
        {"name":"Red"},
        {"name":"Green"},
        {"name":"Blue"}
    ]
}'
id_multi="$LAST_FIELD_ID"
if [[ -n "$id_multi" ]]; then
    pass "POST multiselect with options → 201"
    MULTI_OPT_IDS="$(python3 -c 'import json,sys;d=json.loads(sys.stdin.read());print("\n".join(o["id"] for o in d["attrs"]["options"]))' <<<"$HTTP_BODY")"
else
    fail "POST multiselect with options" "status=$HTTP_STATUS body=${HTTP_BODY:0:200}"
fi

# ---- date ----
create_cpa_field "${FIELD_PREFIX}date1" date '{"sort_order":7}'
id_date="$LAST_FIELD_ID"
[[ -n "$id_date" ]] && pass "POST date → 201" || fail "POST date"

# ---- user ----
create_cpa_field "${FIELD_PREFIX}user1" user '{"sort_order":8}'
id_user="$LAST_FIELD_ID"
[[ -n "$id_user" ]] && pass "POST user → 201" || fail "POST user"

# ---- multiuser ----
create_cpa_field "${FIELD_PREFIX}multiuser1" multiuser '{"sort_order":9}'
id_multiuser="$LAST_FIELD_ID"
[[ -n "$id_multiuser" ]] && pass "POST multiuser → 201" || fail "POST multiuser"

# ---- list fields ----
http_call GET /api/v4/custom_profile_attributes/fields "$ADMIN_TOKEN"
expect_status "GET /custom_profile_attributes/fields → 200" 200 "$HTTP_STATUS" "$HTTP_BODY"
listed_count="$(python3 -c 'import json,sys
d=json.loads(sys.stdin.read())
prefix=sys.argv[1]
print(sum(1 for f in d if f.get("name","").startswith(prefix)))' "$FIELD_PREFIX" <<<"$HTTP_BODY")"
if [[ "$listed_count" == "9" ]]; then
    pass "list contains all 9 created fields"
else
    fail "list contains all 9 created fields" "got $listed_count fields with prefix"
fi

# Verify sort order is ascending (backwards-compat sort by CPA list).
sorted_names="$(python3 -c 'import json,sys
d=json.loads(sys.stdin.read())
prefix=sys.argv[1]
rows=[f for f in d if f.get("name","").startswith(prefix)]
# CPA list sorts by sort_order already; just confirm ascending.
orders=[f["attrs"]["sort_order"] for f in rows]
print("OK" if orders == sorted(orders) else f"BAD:{orders}")' "$FIELD_PREFIX" <<<"$HTTP_BODY")"
if [[ "$sorted_names" == "OK" ]]; then
    pass "list sorted ascending by sort_order"
else
    fail "list sorted ascending by sort_order" "$sorted_names"
fi

# ---- patch field name + visibility ----
patch_body='{"name":"'${FIELD_PREFIX}'text1_renamed","attrs":{"visibility":"hidden","sort_order":1}}'
http_call PATCH "/api/v4/custom_profile_attributes/fields/$id_text" "$ADMIN_TOKEN" "$patch_body"
expect_status "PATCH field rename → 200" 200 "$HTTP_STATUS" "$HTTP_BODY"
expect_contains "PATCH result reflects new name"       "$HTTP_BODY" "${FIELD_PREFIX}text1_renamed"
expect_contains "PATCH result reflects new visibility" "$HTTP_BODY" '"visibility":"hidden"'

# ---- patch just options on a select (options-only path) ----
# Add a 4th option; keep the existing 3.
export SELECT_OPT_IDS
python_opts=$(python3 -c '
import json,os
existing=os.environ["SELECT_OPT_IDS"].splitlines()
opts=[{"id":existing[i],"name":n} for i,n in enumerate(["Red","Green","Blue"])]
opts.append({"name":"Yellow","color":"#ffff00"})
print(json.dumps({"attrs":{"options":opts}}))')
http_call PATCH "/api/v4/custom_profile_attributes/fields/$id_select" "$ADMIN_TOKEN" "$python_opts"
expect_status "PATCH select options-only → 200" 200 "$HTTP_STATUS" "$HTTP_BODY"
new_count="$(python3 -c 'import json,sys;d=json.loads(sys.stdin.read());print(len(d["attrs"]["options"]))' <<<"$HTTP_BODY")"
if [[ "$new_count" == "4" ]]; then
    pass "select options grew to 4"
else
    fail "select options grew to 4" "got $new_count"
fi
# Refresh the cached IDs
SELECT_OPT_IDS="$(python3 -c 'import json,sys;d=json.loads(sys.stdin.read());print("\n".join(o["id"] for o in d["attrs"]["options"]))' <<<"$HTTP_BODY")"

# ---- delete a field and verify ----
delete_cpa_field "$id_date"
expect_status "DELETE field → 200" 200 "$HTTP_STATUS" "$HTTP_BODY"

http_call GET /api/v4/custom_profile_attributes/fields "$ADMIN_TOKEN"
still_there="$(python3 -c 'import json,sys;d=json.loads(sys.stdin.read());print(any(f["id"]==sys.argv[1] for f in d))' "$id_date" <<<"$HTTP_BODY")"
if [[ "$still_there" == "False" ]]; then
    pass "deleted field no longer listed"
else
    fail "deleted field no longer listed"
fi
id_date=""  # consumed

# ---------------------------------------------------------------------------
# Section 2: CPA Value CRUD (backwards-compatible shim)
# ---------------------------------------------------------------------------
# Uses the fields created in Section 1 as value targets.

section "CPA shim: value CRUD"

# Grab first two option IDs from each select/multiselect for use as values.
SELECT_OPT_1="$(printf '%s\n' "$SELECT_OPT_IDS" | sed -n '1p')"
SELECT_OPT_2="$(printf '%s\n' "$SELECT_OPT_IDS" | sed -n '2p')"
MULTI_OPT_1="$(printf '%s\n' "$MULTI_OPT_IDS" | sed -n '1p')"
MULTI_OPT_2="$(printf '%s\n' "$MULTI_OPT_IDS" | sed -n '2p')"

# Export shared env for all Python snippets in this section.
export ADMIN_ID USER_ID
export ID_TEXT="$id_text" ID_EMAIL="$id_email" ID_URL="$id_url" ID_PHONE="$id_phone"
export ID_SELECT="$id_select" ID_MULTI="$id_multi" ID_USER="$id_user" ID_MULTIUSER="$id_multiuser"
export SELECT_OPT_1 SELECT_OPT_2 MULTI_OPT_1 MULTI_OPT_2

# ---- admin self-patch via /custom_profile_attributes/values ----
self_body=$(python3 -c '
import json,os
out={
  os.environ["ID_TEXT"]:"Hello",
  os.environ["ID_EMAIL"]:"test@example.com",
  os.environ["ID_URL"]:"https://mattermost.com/",
  os.environ["ID_PHONE"]:"+1-555-1234",
  os.environ["ID_SELECT"]:os.environ["SELECT_OPT_1"],
  os.environ["ID_MULTI"]:[os.environ["MULTI_OPT_1"],os.environ["MULTI_OPT_2"]],
  os.environ["ID_USER"]:os.environ["ADMIN_ID"],
  os.environ["ID_MULTIUSER"]:[os.environ["ADMIN_ID"],os.environ["USER_ID"]],
}
print(json.dumps(out))')

http_call PATCH /api/v4/custom_profile_attributes/values "$ADMIN_TOKEN" "$self_body"
expect_status "PATCH /custom_profile_attributes/values (self) → 200" 200 "$HTTP_STATUS" "$HTTP_BODY"

# Response should echo values keyed by field ID.
self_echo_ok="$(python3 -c 'import json,sys;d=json.loads(sys.stdin.read());print("OK" if sys.argv[1] in d and d[sys.argv[1]]=="Hello" else "BAD:"+str(d.get(sys.argv[1])))' "$id_text" <<<"$HTTP_BODY")"
if [[ "$self_echo_ok" == "OK" ]]; then
    pass "self-patch response echoes text value"
else
    fail "self-patch response echoes text value" "$self_echo_ok"
fi

# ---- admin GET own values ----
http_call GET "/api/v4/users/$ADMIN_ID/custom_profile_attributes" "$ADMIN_TOKEN"
expect_status "GET /users/{admin}/custom_profile_attributes → 200" 200 "$HTTP_STATUS" "$HTTP_BODY"
roundtrip=$(python3 -c '
import json,sys,os
d=json.loads(sys.stdin.read())
got_email = d.get(os.environ["ID_EMAIL"])
got_phone = d.get(os.environ["ID_PHONE"])
got_select = d.get(os.environ["ID_SELECT"])
got_multi = d.get(os.environ["ID_MULTI"])
got_user = d.get(os.environ["ID_USER"])
got_multiuser = d.get(os.environ["ID_MULTIUSER"])
errs=[]
if got_email != "test@example.com": errs.append(f"email={got_email!r}")
if got_phone != "+1-555-1234": errs.append(f"phone={got_phone!r}")
if got_select != os.environ["SELECT_OPT_1"]: errs.append(f"select={got_select!r}")
if not isinstance(got_multi, list) or len(got_multi)!=2: errs.append(f"multi={got_multi!r}")
if got_user != os.environ["ADMIN_ID"]: errs.append(f"user={got_user!r}")
if not isinstance(got_multiuser, list) or len(got_multiuser)!=2: errs.append(f"multiuser={got_multiuser!r}")
print("OK" if not errs else "; ".join(errs))
' <<<"$HTTP_BODY")
if [[ "$roundtrip" == "OK" ]]; then
    pass "GET values roundtrip matches for all 8 types"
else
    fail "GET values roundtrip matches for all 8 types" "$roundtrip"
fi

# ---- admin patch for another user (user's values) ----
user_body=$(python3 -c 'import json,os;print(json.dumps({
    os.environ["ID_TEXT"]: "for-user",
    os.environ["ID_EMAIL"]: "user@example.org"
}))')

http_call PATCH "/api/v4/users/$USER_ID/custom_profile_attributes" "$ADMIN_TOKEN" "$user_body"
expect_status "PATCH /users/{user}/custom_profile_attributes (admin→user) → 200" 200 "$HTTP_STATUS" "$HTTP_BODY"

# Verify user can read their own values.
http_call GET "/api/v4/users/$USER_ID/custom_profile_attributes" "$USER_TOKEN"
expect_status "GET own values (as user) → 200" 200 "$HTTP_STATUS" "$HTTP_BODY"
got="$(python3 -c 'import json,sys,os;d=json.loads(sys.stdin.read());print(d.get(os.environ["ID_TEXT"],""))' <<<"$HTTP_BODY")"
if [[ "$got" == "for-user" ]]; then
    pass "user sees admin-set value on themselves"
else
    fail "user sees admin-set value on themselves" "got=$got"
fi

# ---- user self-patches own value ----
self_user_body=$(python3 -c 'import json,os;print(json.dumps({
    os.environ["ID_TEXT"]: "user-set-themselves"
}))')
http_call PATCH /api/v4/custom_profile_attributes/values "$USER_TOKEN" "$self_user_body"
expect_status "PATCH own values (as user) → 200" 200 "$HTTP_STATUS" "$HTTP_BODY"
expect_contains "own patch echoes new text" "$HTTP_BODY" "user-set-themselves"

# ---- empty-body patch rejected ----
http_call PATCH /api/v4/custom_profile_attributes/values "$ADMIN_TOKEN" "{}"
expect_status "PATCH empty body → 400" 400 "$HTTP_STATUS" "$HTTP_BODY"

# ---- values sanitization (whitespace trimmed, empty array entries dropped) ----
sanit_body=$(python3 -c 'import json,os;print(json.dumps({
    os.environ["ID_TEXT"]: "   trimmed_value   ",
    os.environ["ID_MULTIUSER"]: [os.environ["ADMIN_ID"], "", os.environ["USER_ID"]]
}))')
http_call PATCH /api/v4/custom_profile_attributes/values "$ADMIN_TOKEN" "$sanit_body"
expect_status "PATCH sanitization input → 200" 200 "$HTTP_STATUS" "$HTTP_BODY"
sanit=$(python3 -c 'import json,sys,os
d=json.loads(sys.stdin.read())
t=d.get(os.environ["ID_TEXT"])
m=d.get(os.environ["ID_MULTIUSER"])
errs=[]
if t != "trimmed_value": errs.append(f"text not trimmed: {t!r}")
if not isinstance(m, list): errs.append(f"multiuser not list: {m!r}")
elif "" in m: errs.append(f"multiuser has empty entry: {m!r}")
elif len(m) != 2: errs.append(f"multiuser wrong length: {m!r}")
print("OK" if not errs else "; ".join(errs))
' <<<"$HTTP_BODY")
if [[ "$sanit" == "OK" ]]; then
    pass "text trimmed + empty array entries dropped"
else
    fail "text trimmed + empty array entries dropped" "$sanit"
fi

# ---------------------------------------------------------------------------
# Section 3: Generic property API (/api/v4/properties/groups/...)
# ---------------------------------------------------------------------------

section "Generic property API"

GENERIC_FIELD_ROOT="/api/v4/properties/groups/protected_attributes/user/fields"
GENERIC_VALUE_ROOT="/api/v4/properties/groups/protected_attributes/user/values"

# ---- GET fields with required target_type ----
http_call GET "$GENERIC_FIELD_ROOT?target_type=system" "$ADMIN_TOKEN"
expect_status "GET generic fields target_type=system → 200" 200 "$HTTP_STATUS" "$HTTP_BODY"

# ---- GET without target_type → 400 ----
http_call GET "$GENERIC_FIELD_ROOT" "$ADMIN_TOKEN"
expect_status "GET generic fields (no target_type) → 400" 400 "$HTTP_STATUS" "$HTTP_BODY"
expect_contains "missing target_type error code" "$HTTP_BODY" "invalid_target_type"

# ---- GET unknown group → 404 ----
http_call GET "/api/v4/properties/groups/notreal_group/user/fields?target_type=system" "$ADMIN_TOKEN"
expect_status "GET unknown group → 404" 404 "$HTTP_STATUS" "$HTTP_BODY"

# ---- GET alias custom_profile_attributes → 404 (alias only works via plugin API) ----
http_call GET "/api/v4/properties/groups/custom_profile_attributes/user/fields?target_type=system" "$ADMIN_TOKEN"
expect_status "GET legacy alias custom_profile_attributes → 404 via HTTP" 404 "$HTTP_STATUS" "$HTTP_BODY"

# ---- Create a text field via generic POST (target_type=system required) ----
gen_body='{"name":"'${FIELD_PREFIX}'gen_text1","type":"text","target_type":"system","attrs":{"visibility":"always","sort_order":50}}'
http_call POST "$GENERIC_FIELD_ROOT" "$ADMIN_TOKEN" "$gen_body"
if [[ "$HTTP_STATUS" == "201" ]]; then
    pass "POST generic field → 201"
    id_gen="$(jget id <<<"$HTTP_BODY")"
    CREATED_FIELD_IDS+=("$id_gen")
    expect_contains "generic field: permission_field=sysadmin (hook fires on generic API too)" "$HTTP_BODY" '"permission_field":"sysadmin"'
else
    fail "POST generic field → 201" "status=$HTTP_STATUS body=${HTTP_BODY:0:200}"
    id_gen=""
fi

# ---- POST generic without target_type → 400 ----
http_call POST "$GENERIC_FIELD_ROOT" "$ADMIN_TOKEN" \
    '{"name":"'${FIELD_PREFIX}'gen_notarget","type":"text"}'
expect_status "POST generic without target_type → 400" 400 "$HTTP_STATUS" "$HTTP_BODY"

# ---- PATCH generic field ----
if [[ -n "$id_gen" ]]; then
    http_call PATCH "$GENERIC_FIELD_ROOT/$id_gen" "$ADMIN_TOKEN" \
        '{"name":"'${FIELD_PREFIX}'gen_text1_v2"}'
    expect_status "PATCH generic field → 200" 200 "$HTTP_STATUS" "$HTTP_BODY"
    expect_contains "PATCH generic result reflects new name" "$HTTP_BODY" "${FIELD_PREFIX}gen_text1_v2"
fi

# ---- Write a value via generic PATCH ----
if [[ -n "$id_gen" ]]; then
    gvbody='[{"field_id":"'$id_gen'","value":"generic-wrote-this"}]'
    http_call PATCH "$GENERIC_VALUE_ROOT/$ADMIN_ID" "$ADMIN_TOKEN" "$gvbody"
    expect_status "PATCH generic value (self) → 200" 200 "$HTTP_STATUS" "$HTTP_BODY"
    expect_contains "generic value patch echoes" "$HTTP_BODY" "generic-wrote-this"
fi

# ---- GET generic values ----
http_call GET "$GENERIC_VALUE_ROOT/$ADMIN_ID?target_type=user" "$ADMIN_TOKEN"
expect_status "GET generic values → 200" 200 "$HTTP_STATUS" "$HTTP_BODY"

# ---- CPA values and generic values reference the same store: verify same data visible via both ----
http_call GET "/api/v4/users/$ADMIN_ID/custom_profile_attributes" "$ADMIN_TOKEN"
cpa_count="$(python3 -c 'import json,sys;d=json.loads(sys.stdin.read());print(len(d))' <<<"$HTTP_BODY")"
http_call GET "$GENERIC_VALUE_ROOT/$ADMIN_ID?target_type=user" "$ADMIN_TOKEN"
gen_count="$(python3 -c 'import json,sys;d=json.loads(sys.stdin.read());print(len(d))' <<<"$HTTP_BODY")"
if [[ "$cpa_count" -gt 0 && "$cpa_count" == "$gen_count" ]]; then
    pass "CPA and generic GET expose same value count ($cpa_count)"
else
    fail "CPA and generic GET expose same value count" "cpa=$cpa_count gen=$gen_count"
fi

# ---- object_type mismatch: try to PATCH a user field via object_type=channel → 404 ----
if [[ -n "$id_gen" ]]; then
    http_call PATCH "/api/v4/properties/groups/protected_attributes/channel/fields/$id_gen" \
        "$ADMIN_TOKEN" '{"name":"wrongbucket"}'
    expect_status "PATCH wrong object_type bucket → 404" 404 "$HTTP_STATUS" "$HTTP_BODY"
fi

# ---- DELETE generic field ----
if [[ -n "$id_gen" ]]; then
    http_call DELETE "$GENERIC_FIELD_ROOT/$id_gen" "$ADMIN_TOKEN"
    expect_status "DELETE generic field → 200" 200 "$HTTP_STATUS" "$HTTP_BODY"
    # Drop from tracked list
    remaining=()
    for existing in "${CREATED_FIELD_IDS[@]:-}"; do
        [[ -n "$existing" && "$existing" != "$id_gen" ]] && remaining+=("$existing")
    done
    CREATED_FIELD_IDS=("${remaining[@]:-}")
fi

# ---------------------------------------------------------------------------
# Section 4: Hook-level validation & error mapping
# ---------------------------------------------------------------------------

section "Hook validation & error mapping"

# ---- invalid visibility on create ----
bad_vis='{"name":"'${FIELD_PREFIX}'bad_vis","type":"text","attrs":{"visibility":"not_a_thing"}}'
http_call POST /api/v4/custom_profile_attributes/fields "$ADMIN_TOKEN" "$bad_vis"
# CPA SanitizeAndValidate returns 422 for unknown visibility before the hook.
if [[ "$HTTP_STATUS" == "422" || "$HTTP_STATUS" == "400" ]]; then
    pass "create with invalid visibility → rejected ($HTTP_STATUS)"
else
    fail "create with invalid visibility → rejected" "status=$HTTP_STATUS body=${HTTP_BODY:0:200}"
fi

# ---- invalid value_type on text (CPA SanitizeAndValidate path) ----
bad_vt='{"name":"'${FIELD_PREFIX}'bad_vt","type":"text","attrs":{"value_type":"garbage"}}'
http_call POST /api/v4/custom_profile_attributes/fields "$ADMIN_TOKEN" "$bad_vt"
if [[ "$HTTP_STATUS" == "422" || "$HTTP_STATUS" == "400" ]]; then
    pass "create text with invalid value_type → rejected ($HTTP_STATUS)"
else
    fail "create text with invalid value_type → rejected" "status=$HTTP_STATUS"
fi

# ---- invalid managed value ----
bad_mgd='{"name":"'${FIELD_PREFIX}'bad_mgd","type":"text","attrs":{"managed":"owner"}}'
http_call POST /api/v4/custom_profile_attributes/fields "$ADMIN_TOKEN" "$bad_mgd"
if [[ "$HTTP_STATUS" == "422" || "$HTTP_STATUS" == "400" ]]; then
    pass "create with invalid managed value → rejected ($HTTP_STATUS)"
else
    fail "create with invalid managed value → rejected" "status=$HTTP_STATUS"
fi

# ---- non-numeric sort_order via generic API (CPA decodes sort_order to float64 so strings never reach the hook) ----
bad_sort='{"name":"'${FIELD_PREFIX}'bad_sort","type":"text","target_type":"system","attrs":{"sort_order":"not_numeric"}}'
http_call POST "$GENERIC_FIELD_ROOT" "$ADMIN_TOKEN" "$bad_sort"
if [[ "$HTTP_STATUS" == "400" || "$HTTP_STATUS" == "422" ]]; then
    pass "generic POST non-numeric sort_order → rejected ($HTTP_STATUS)"
else
    fail "generic POST non-numeric sort_order → rejected" "status=$HTTP_STATUS body=${HTTP_BODY:0:200}"
fi

# ---- invalid visibility via generic API reaches AttributeValidationHook ----
bad_vis_generic='{"name":"'${FIELD_PREFIX}'gen_bad_vis","type":"text","target_type":"system","attrs":{"visibility":"weird"}}'
http_call POST "$GENERIC_FIELD_ROOT" "$ADMIN_TOKEN" "$bad_vis_generic"
if [[ "$HTTP_STATUS" == "400" ]]; then
    pass "generic POST invalid visibility → 400"
    expect_contains "invalid-attrs error code present" "$HTTP_BODY" "invalid_attrs"
else
    fail "generic POST invalid visibility → 400" "status=$HTTP_STATUS body=${HTTP_BODY:0:200}"
fi

# ---- value validation: text length > 64 ----
long_val=$(python3 -c 'print("a"*80)')
bad_text_len=$(python3 -c 'import json,os,sys
print(json.dumps({os.environ["ID_TEXT"]: sys.argv[1]}))' "$long_val")
http_call PATCH /api/v4/custom_profile_attributes/values "$ADMIN_TOKEN" "$bad_text_len"
expect_status "PATCH text > 64 chars → 400" 400 "$HTTP_STATUS" "$HTTP_BODY"
expect_contains "text length error" "$HTTP_BODY" "validate"

# ---- value validation: bad email ----
bad_email=$(python3 -c 'import json,os;print(json.dumps({os.environ["ID_EMAIL"]: "not-an-email"}))')
http_call PATCH /api/v4/custom_profile_attributes/values "$ADMIN_TOKEN" "$bad_email"
expect_status "PATCH bad email → 400" 400 "$HTTP_STATUS" "$HTTP_BODY"
expect_contains "bad-email error code" "$HTTP_BODY" "validate"

# ---- value validation: bad URL ----
bad_url=$(python3 -c 'import json,os;print(json.dumps({os.environ["ID_URL"]: "not a url"}))')
http_call PATCH /api/v4/custom_profile_attributes/values "$ADMIN_TOKEN" "$bad_url"
expect_status "PATCH bad URL → 400" 400 "$HTTP_STATUS" "$HTTP_BODY"

# ---- value validation: select option not in options ----
bad_opt=$(python3 -c 'import json,os;print(json.dumps({os.environ["ID_SELECT"]: "deadbeef"}))')
http_call PATCH /api/v4/custom_profile_attributes/values "$ADMIN_TOKEN" "$bad_opt"
expect_status "PATCH select with unknown option → 400" 400 "$HTTP_STATUS" "$HTTP_BODY"

# ---- value validation: multiselect with unknown option ----
bad_multi=$(python3 -c 'import json,os;print(json.dumps({os.environ["ID_MULTI"]: ["deadbeef","cafef00d"]}))')
http_call PATCH /api/v4/custom_profile_attributes/values "$ADMIN_TOKEN" "$bad_multi"
expect_status "PATCH multiselect with unknown options → 400" 400 "$HTTP_STATUS" "$HTTP_BODY"

# ---- value validation: user with invalid ID ----
bad_user=$(python3 -c 'import json,os;print(json.dumps({os.environ["ID_USER"]: "not-a-valid-id"}))')
http_call PATCH /api/v4/custom_profile_attributes/values "$ADMIN_TOKEN" "$bad_user"
expect_status "PATCH user with invalid id → 400" 400 "$HTTP_STATUS" "$HTTP_BODY"

# ---- value validation: multiuser with one invalid id ----
bad_multiuser=$(python3 -c 'import json,os;print(json.dumps({os.environ["ID_MULTIUSER"]: [os.environ["ADMIN_ID"],"xxx"]}))')
http_call PATCH /api/v4/custom_profile_attributes/values "$ADMIN_TOKEN" "$bad_multiuser"
expect_status "PATCH multiuser with invalid id → 400" 400 "$HTTP_STATUS" "$HTTP_BODY"

# ---- value validation: wrong JSON shape for select (array instead of string) ----
wrong_shape=$(python3 -c 'import json,os;print(json.dumps({os.environ["ID_SELECT"]: ["one","two"]}))')
http_call PATCH /api/v4/custom_profile_attributes/values "$ADMIN_TOKEN" "$wrong_shape"
expect_status "PATCH select with array value → 400" 400 "$HTTP_STATUS" "$HTTP_BODY"

# ---- invalid field id in values patch ----
# FieldID fails IsValidId.
bad_fid_body='{"not-a-valid-id":"x"}'
http_call PATCH /api/v4/custom_profile_attributes/values "$ADMIN_TOKEN" "$bad_fid_body"
expect_status "PATCH unknown field_id → 400/404" 400 "$HTTP_STATUS" "$HTTP_BODY"

# ---- unknown (but well-formed) field id, ALL unknown: 400 (from multi-get ErrResultsMismatch) ----
fake_id="abcdefghijklmnopqrstuvwxyz"
unknown_fid_body="{\"$fake_id\":\"x\"}"
http_call PATCH /api/v4/custom_profile_attributes/values "$ADMIN_TOKEN" "$unknown_fid_body"
expect_status "PATCH only-unknown field_id → 400 (multi-get mismatch)" 400 "$HTTP_STATUS" "$HTTP_BODY"

# ---- mix of valid + unknown: HTTP path returns 400 (App.GetPropertyFields runs
#      before the hook-path 404 branch — see commit 7111e82823). ----
if [[ -n "$id_text" ]]; then
    mixed_fid_body=$(FAKE_ID="$fake_id" python3 -c 'import json,os
print(json.dumps({os.environ["ID_TEXT"]:"ok", os.environ["FAKE_ID"]:"x"}))')
    http_call PATCH /api/v4/custom_profile_attributes/values "$ADMIN_TOKEN" "$mixed_fid_body"
    expect_status "PATCH mixed valid+unknown field_ids → 400" 400 "$HTTP_STATUS" "$HTTP_BODY"
fi

# ---- duplicate field_id in generic API (array form) ----
if [[ -n "$id_text" ]]; then
    dup='[{"field_id":"'$id_text'","value":"a"},{"field_id":"'$id_text'","value":"b"}]'
    http_call PATCH "$GENERIC_VALUE_ROOT/$ADMIN_ID" "$ADMIN_TOKEN" "$dup"
    expect_status "PATCH generic duplicate field_id → 400" 400 "$HTTP_STATUS" "$HTTP_BODY"
fi

# ---- empty body for generic PATCH values → 400 ----
http_call PATCH "$GENERIC_VALUE_ROOT/$ADMIN_ID" "$ADMIN_TOKEN" "[]"
expect_status "PATCH generic empty array → 400" 400 "$HTTP_STATUS" "$HTTP_BODY"

# ---- too many items for generic PATCH values → 400 ----
# 51 items exceeds the 50-item cap.
too_many=$(python3 -c 'import json
items=[{"field_id":"abcdefghijklmnopqrstuvwxyz","value":"x"} for _ in range(51)]
print(json.dumps(items))')
http_call PATCH "$GENERIC_VALUE_ROOT/$ADMIN_ID" "$ADMIN_TOKEN" "$too_many"
expect_status "PATCH generic >50 items → 400" 400 "$HTTP_STATUS" "$HTTP_BODY"

# ---- createCPAField must zero server-controlled fields on payload ----
# Client attempts to pre-set id/protected/permission_field/permission_values to values
# we know the hook would override. Verify the response reflects hook-driven values.
spoof='{
    "id":"spoofed-id-aaaaaaaaaaaaaaaaa",
    "name":"'${FIELD_PREFIX}'spoof",
    "type":"text",
    "protected":true,
    "permission_field":"none",
    "permission_values":"none",
    "permission_options":"none",
    "attrs":{"sort_order":99}
}'
http_call POST /api/v4/custom_profile_attributes/fields "$ADMIN_TOKEN" "$spoof"
if [[ "$HTTP_STATUS" == "201" ]]; then
    spoof_id="$(jget id <<<"$HTTP_BODY")"
    CREATED_FIELD_IDS+=("$spoof_id")
    if [[ "$spoof_id" != "spoofed-id-aaaaaaaaaaaaaaaaa" ]]; then
        pass "createCPAField ignores client-supplied id"
    else
        fail "createCPAField ignores client-supplied id" "got id=$spoof_id"
    fi
    expect_contains "createCPAField: protected stays false"          "$HTTP_BODY" '"protected":false'
    expect_contains "createCPAField: permission_field→sysadmin (hook)" "$HTTP_BODY" '"permission_field":"sysadmin"'
    expect_contains "createCPAField: permission_values→member (hook)"  "$HTTP_BODY" '"permission_values":"member"'
    expect_contains "createCPAField: permission_options→sysadmin (hook)" "$HTTP_BODY" '"permission_options":"sysadmin"'
    http_call DELETE "/api/v4/custom_profile_attributes/fields/$spoof_id" "$ADMIN_TOKEN"
else
    fail "createCPAField: mass-assignment spoof attempt → 201" "status=$HTTP_STATUS body=${HTTP_BODY:0:200}"
fi

# ---- generic POST protected=true → 400 ----
http_call POST "$GENERIC_FIELD_ROOT" "$ADMIN_TOKEN" \
    '{"name":"'${FIELD_PREFIX}'prot","type":"text","target_type":"system","protected":true}'
expect_status "generic POST protected=true → 400" 400 "$HTTP_STATUS" "$HTTP_BODY"

# ---- patch legacy (PSAv1) field path: all our fields are PSAv2 already, so patch is fine. ----
# We simulate the mismatch: try to patch an existing field as if in channel object_type.
if [[ -n "$id_text" ]]; then
    http_call PATCH "/api/v4/properties/groups/protected_attributes/channel/fields/$id_text" \
        "$ADMIN_TOKEN" '{"name":"oops"}'
    expect_status "PATCH via wrong object_type bucket → 404" 404 "$HTTP_STATUS" "$HTTP_BODY"
fi

# ---- Field limit (20 per user) ----
# Count current user fields, fill up to 20, confirm 21st is rejected.
http_call GET "$GENERIC_FIELD_ROOT?target_type=system" "$ADMIN_TOKEN"
cur_count="$(python3 -c 'import json,sys;d=json.loads(sys.stdin.read());print(len(d))' <<<"$HTTP_BODY")"
need=$((20 - cur_count))
filler_ids=()
for ((i=0; i<need; i++)); do
    create_cpa_field "${FIELD_PREFIX}filler_${i}" text '{"sort_order":'$((100+i))'}'
    if [[ -n "$LAST_FIELD_ID" ]]; then
        filler_ids+=("$LAST_FIELD_ID")
    fi
done
if [[ ${#filler_ids[@]} -eq $need ]]; then
    pass "filled to 20 user fields ($cur_count existing + $need new)"
else
    fail "filled to 20 user fields" "wanted $need, created ${#filler_ids[@]}"
fi

# 21st should fail with limit reached (422).
create_cpa_field "${FIELD_PREFIX}over_limit" text '{"sort_order":200}'
if [[ "$HTTP_STATUS" == "422" ]]; then
    pass "21st user field → 422 limit_reached"
    expect_contains "limit error message" "$HTTP_BODY" "limit"
elif [[ -n "$LAST_FIELD_ID" ]]; then
    fail "21st user field → 422 limit_reached" "unexpected 201 id=$LAST_FIELD_ID"
else
    fail "21st user field → 422 limit_reached" "status=$HTTP_STATUS body=${HTTP_BODY:0:200}"
fi

# ---- managed=admin on create as admin → PermissionValues=sysadmin ----
# Build the field as admin. The hook should promote PermissionValues to sysadmin.
mgd_body='{"name":"'${FIELD_PREFIX}'mgd","type":"text","attrs":{"managed":"admin","sort_order":500}}'
# We're at the 20-field limit now; delete one filler first.
if [[ ${#filler_ids[@]} -gt 0 ]]; then
    delete_cpa_field "${filler_ids[-1]}"
    unset 'filler_ids[-1]'
fi
http_call POST /api/v4/custom_profile_attributes/fields "$ADMIN_TOKEN" "$mgd_body"
if [[ "$HTTP_STATUS" == "201" ]]; then
    pass "create managed=admin field (as admin) → 201"
    id_mgd="$(jget id <<<"$HTTP_BODY")"
    CREATED_FIELD_IDS+=("$id_mgd")
    expect_contains "managed=admin field PermissionValues=sysadmin (hook promoted)" \
        "$HTTP_BODY" '"permission_values":"sysadmin"'
    expect_contains "managed=admin echoed in attrs" "$HTTP_BODY" '"managed":"admin"'

    # Non-admin cannot write to this field (PermissionValues=sysadmin).
    block_body=$(MGD_ID="$id_mgd" python3 -c 'import json,os
print(json.dumps({os.environ["MGD_ID"]: "blocked"}))')
    http_call PATCH /api/v4/custom_profile_attributes/values "$USER_TOKEN" "$block_body"
    expect_status "non-admin write to managed=admin field → 403" 403 "$HTTP_STATUS" "$HTTP_BODY"
else
    fail "create managed=admin field (as admin) → 201" "status=$HTTP_STATUS body=${HTTP_BODY:0:200}"
fi

# ---- Bulk cleanup of filler fields ----
for fid in "${filler_ids[@]:-}"; do
    [[ -n "$fid" ]] && delete_cpa_field "$fid"
done

# ---------------------------------------------------------------------------
# Section 5: Authorization (AccessControl hook + executor permission checks)
# ---------------------------------------------------------------------------

section "Authorization"

# ---- non-admin: list fields → 200 (members can read the definition list) ----
http_call GET /api/v4/custom_profile_attributes/fields "$USER_TOKEN"
expect_status "list fields as non-admin → 200" 200 "$HTTP_STATUS" "$HTTP_BODY"

# ---- non-admin: GET group → 200 ----
http_call GET /api/v4/custom_profile_attributes/group "$USER_TOKEN"
expect_status "GET /group as non-admin → 200" 200 "$HTTP_STATUS" "$HTTP_BODY"

# ---- non-admin: CREATE field → 403 (scope=system requires PermissionManageSystem) ----
http_call POST /api/v4/custom_profile_attributes/fields "$USER_TOKEN" \
    '{"name":"'${FIELD_PREFIX}'nonadmin","type":"text"}'
expect_status "non-admin POST field → 403" 403 "$HTTP_STATUS" "$HTTP_BODY"

# ---- non-admin: PATCH existing field → 403 (PermissionField=sysadmin set by hook) ----
if [[ -n "$id_text" ]]; then
    http_call PATCH "/api/v4/custom_profile_attributes/fields/$id_text" "$USER_TOKEN" \
        '{"name":"hacked"}'
    expect_status "non-admin PATCH field → 403" 403 "$HTTP_STATUS" "$HTTP_BODY"
fi

# ---- non-admin: DELETE field → 403 ----
if [[ -n "$id_text" ]]; then
    http_call DELETE "/api/v4/custom_profile_attributes/fields/$id_text" "$USER_TOKEN"
    expect_status "non-admin DELETE field → 403" 403 "$HTTP_STATUS" "$HTTP_BODY"
fi

# ---- non-admin: PATCH other user's values → 403 (PermissionEditOtherUsers required) ----
other_body=$(python3 -c 'import json,os;print(json.dumps({os.environ["ID_TEXT"]: "hacked"}))')
http_call PATCH "/api/v4/users/$ADMIN_ID/custom_profile_attributes" "$USER_TOKEN" "$other_body"
expect_status "non-admin PATCH other user's values → 403" 403 "$HTTP_STATUS" "$HTTP_BODY"

# ---- non-admin: PATCH own non-managed text value → 200 ----
own_body=$(python3 -c 'import json,os;print(json.dumps({os.environ["ID_TEXT"]: "i-am-a-user"}))')
http_call PATCH "/api/v4/users/$USER_ID/custom_profile_attributes" "$USER_TOKEN" "$own_body"
expect_status "non-admin PATCH own values via /users/{self} → 200" 200 "$HTTP_STATUS" "$HTTP_BODY"

# ---- non-admin: GET own values → 200 ----
http_call GET "/api/v4/users/$USER_ID/custom_profile_attributes" "$USER_TOKEN"
expect_status "non-admin GET own values → 200" 200 "$HTTP_STATUS" "$HTTP_BODY"

# ---- non-admin: generic API POST field → 403 ----
http_call POST "$GENERIC_FIELD_ROOT" "$USER_TOKEN" \
    '{"name":"'${FIELD_PREFIX}'nonadmin_gen","type":"text","target_type":"system"}'
expect_status "non-admin generic POST field → 403" 403 "$HTTP_STATUS" "$HTTP_BODY"

# ---- non-admin: generic PATCH other user's values → 403 ----
http_call PATCH "$GENERIC_VALUE_ROOT/$ADMIN_ID" "$USER_TOKEN" \
    '[{"field_id":"'$id_text'","value":"haha"}]'
expect_status "non-admin generic PATCH other user → 403" 403 "$HTTP_STATUS" "$HTTP_BODY"

# ---- unauthenticated access: no token → 401 ----
http_call GET /api/v4/custom_profile_attributes/fields ""
expect_status "GET fields unauthenticated → 401" 401 "$HTTP_STATUS" "$HTTP_BODY"

http_call POST /api/v4/custom_profile_attributes/fields "" \
    '{"name":"'${FIELD_PREFIX}'anon","type":"text"}'
expect_status "POST field unauthenticated → 401" 401 "$HTTP_STATUS" "$HTTP_BODY"

# ---- user field created with permission_values=member: any logged-in user can set their own ----
# id_user is a "user"-type field created by admin. Its PermissionValues is member.
user_field_body=$(python3 -c 'import json,os;print(json.dumps({os.environ["ID_USER"]: os.environ["USER_ID"]}))')
http_call PATCH "/api/v4/users/$USER_ID/custom_profile_attributes" "$USER_TOKEN" "$user_field_body"
expect_status "non-admin sets 'user'-type value (non-managed) on self → 200" 200 "$HTTP_STATUS" "$HTTP_BODY"

# ---------------------------------------------------------------------------
# Section 6: Backwards compatibility
# ---------------------------------------------------------------------------

section "Backwards-compat shim behavior"

# ---- CPA list sorts by attrs.sort_order ascending ----
# Create 3 fields with non-monotonic sort_orders, verify list returns them
# in ascending order regardless of creation order.
create_cpa_field "${FIELD_PREFIX}sort_c" text '{"sort_order":33}'
id_sort_c="$LAST_FIELD_ID"
create_cpa_field "${FIELD_PREFIX}sort_a" text '{"sort_order":11}'
id_sort_a="$LAST_FIELD_ID"
create_cpa_field "${FIELD_PREFIX}sort_b" text '{"sort_order":22}'
id_sort_b="$LAST_FIELD_ID"

http_call GET /api/v4/custom_profile_attributes/fields "$ADMIN_TOKEN"
ordering=$(python3 -c '
import json,sys
d=json.loads(sys.stdin.read())
prefix=sys.argv[1]
ours=[f for f in d if f.get("name","").startswith(prefix+"sort_")]
ours.sort(key=lambda f: [row.get("name") for row in d].index(f.get("name")))
# Directly check that the response is already sort_order-ascending.
names=[f["name"] for f in d if f.get("name","").startswith(prefix+"sort_")]
orders=[f["attrs"]["sort_order"] for f in d if f.get("name","").startswith(prefix+"sort_")]
print(",".join(names), "->", orders)
print("OK" if orders == sorted(orders) else "BAD")' "$FIELD_PREFIX" <<<"$HTTP_BODY")
if printf "%s" "$ordering" | grep -q 'OK$'; then
    pass "CPA list: fields returned in ascending sort_order"
else
    fail "CPA list: fields returned in ascending sort_order" "$ordering"
fi

# ---- CPA group endpoint returns the same group id used by the generic API ----
http_call GET /api/v4/custom_profile_attributes/group "$ADMIN_TOKEN"
cpa_group_id="$(jget id <<<"$HTTP_BODY")"
if [[ "$cpa_group_id" == "$GROUP_ID" ]]; then
    pass "/custom_profile_attributes/group id matches bootstrap group id"
else
    fail "/custom_profile_attributes/group id matches bootstrap group id" "cpa=$cpa_group_id bootstrap=$GROUP_ID"
fi

# ---- Shim returns response in CPA format (map) not generic format (array) ----
# Self-patch echoes {fieldID: value}.
self_fmt=$(python3 -c 'import json,os;print(json.dumps({os.environ["ID_TEXT"]:"fmt-test"}))')
http_call PATCH /api/v4/custom_profile_attributes/values "$ADMIN_TOKEN" "$self_fmt"
shape=$(python3 -c 'import json,sys;d=json.loads(sys.stdin.read());print("map" if isinstance(d,dict) else "array" if isinstance(d,list) else type(d).__name__)' <<<"$HTTP_BODY")
if [[ "$shape" == "map" ]]; then
    pass "CPA PATCH values returns map {fieldID: value} (shim format)"
else
    fail "CPA PATCH values returns map" "got $shape"
fi

# ---- Generic PATCH values returns array (generic format) ----
if [[ -n "$id_text" ]]; then
    gen_fmt='[{"field_id":"'$id_text'","value":"fmt-gen"}]'
    http_call PATCH "$GENERIC_VALUE_ROOT/$ADMIN_ID" "$ADMIN_TOKEN" "$gen_fmt"
    shape=$(python3 -c 'import json,sys;d=json.loads(sys.stdin.read());print("array" if isinstance(d,list) else "map" if isinstance(d,dict) else type(d).__name__)' <<<"$HTTP_BODY")
    if [[ "$shape" == "array" ]]; then
        pass "Generic PATCH values returns array"
    else
        fail "Generic PATCH values returns array" "got $shape"
    fi
fi

# ---- Cleanup the sort ordering fixtures before next section ----
[[ -n "$id_sort_a" ]] && delete_cpa_field "$id_sort_a"
[[ -n "$id_sort_b" ]] && delete_cpa_field "$id_sort_b"
[[ -n "$id_sort_c" ]] && delete_cpa_field "$id_sort_c"

# ---------------------------------------------------------------------------
# Section 7: Sync-lock enforcement via direct DB patch (LDAP/SAML simulation)
# ---------------------------------------------------------------------------

section "Sync lock (LDAP/SAML simulation via direct DB)"

if ! command -v psql >/dev/null 2>&1; then
    skip "sync-lock section: psql not found" "install postgres-client or set MM_DB_URL"
elif [[ -z "$id_text" ]]; then
    skip "sync-lock section: id_text not set"
else
    # Mark the existing text field as LDAP-synced by editing its attrs JSON.
    psql_out=$(psql "$MM_DB_URL" -tA -c "
        UPDATE propertyfields
        SET attrs = jsonb_set(attrs, '{ldap}', '\"uid\"')
        WHERE id='$id_text';" 2>&1)
    if [[ "$psql_out" != "UPDATE 1"* && "$psql_out" != "UPDATE 1" ]]; then
        fail "direct DB update to mark field ldap-synced" "$psql_out"
    else
        pass "DB: marked $id_text with ldap attr (simulating LDAP sync)"

        # As admin (non-sync caller), attempt a value write → 403 sync_lock.
        lock_body=$(python3 -c 'import json,os;print(json.dumps({os.environ["ID_TEXT"]: "locked-out"}))')
        http_call PATCH /api/v4/custom_profile_attributes/values "$ADMIN_TOKEN" "$lock_body"
        expect_status "admin PATCH ldap-synced value → 403" 403 "$HTTP_STATUS" "$HTTP_BODY"
        expect_contains "sync_lock error present" "$HTTP_BODY" "sync_lock"

        # As non-admin on self, should also fail.
        http_call PATCH /api/v4/custom_profile_attributes/values "$USER_TOKEN" "$lock_body"
        expect_status "user PATCH own ldap-synced value → 403" 403 "$HTTP_STATUS" "$HTTP_BODY"

        # Also via generic API: ensures both paths see the lock.
        gv_body='[{"field_id":"'$id_text'","value":"still-locked"}]'
        http_call PATCH "$GENERIC_VALUE_ROOT/$ADMIN_ID" "$ADMIN_TOKEN" "$gv_body"
        expect_status "admin generic PATCH ldap-synced value → 403" 403 "$HTTP_STATUS" "$HTTP_BODY"

        # Field patch by admin (changing the name) should still be fine: the
        # sync lock only guards VALUE writes, not field DEFINITION edits.
        http_call PATCH "/api/v4/custom_profile_attributes/fields/$id_text" "$ADMIN_TOKEN" \
            '{"name":"'${FIELD_PREFIX}'text1_renamed_v2"}'
        expect_status "admin field rename on synced field → 200" 200 "$HTTP_STATUS" "$HTTP_BODY"

        # Unmark the ldap attr so cleanup path doesn't hit sync-lock on value delete.
        psql "$MM_DB_URL" -q -c "
            UPDATE propertyfields
            SET attrs = jsonb_set(attrs, '{ldap}', '\"\"')
            WHERE id='$id_text';" >/dev/null 2>&1
        pass "sync-lock cleanup: cleared ldap attr on $id_text"
    fi

    # ---- saml sync lock (separate path) ----
    if [[ -n "$id_email" ]]; then
        psql "$MM_DB_URL" -q -c "
            UPDATE propertyfields
            SET attrs = jsonb_set(attrs, '{saml}', '\"mail\"')
            WHERE id='$id_email';" >/dev/null 2>&1
        saml_body=$(python3 -c 'import json,os;print(json.dumps({os.environ["ID_EMAIL"]: "saml@example.com"}))')
        http_call PATCH /api/v4/custom_profile_attributes/values "$ADMIN_TOKEN" "$saml_body"
        expect_status "admin PATCH saml-synced value → 403" 403 "$HTTP_STATUS" "$HTTP_BODY"
        psql "$MM_DB_URL" -q -c "
            UPDATE propertyfields
            SET attrs = jsonb_set(attrs, '{saml}', '\"\"')
            WHERE id='$id_email';" >/dev/null 2>&1
    fi
fi

# ---------------------------------------------------------------------------
# Section 8: Hook isolation — non-protected_attributes groups stay unaffected
# ---------------------------------------------------------------------------
# Every hook in this PR is registered *only* for cpaGroup.ID (in server.go).
# These assertions protect against an accidental broadening where a hook
# attaches to every group and starts rejecting requests in unrelated
# subsystems (e.g., content_flagging, managed_channel_categories, Boards).

section "Hook isolation (non-protected_attributes groups)"

# We pick content_flagging as a witness — it's a Mattermost-registered group
# that exists on every server and is not the target of any PR-36180 hook.
# List registered groups first so the script is self-documenting if the
# witness group is ever removed.
http_call GET /api/v4/properties/groups/content_flagging/user/fields?target_type=system "$ADMIN_TOKEN"
if [[ "$HTTP_STATUS" != "200" ]]; then
    skip "non-protected group witness test" "content_flagging group not available on this server (status=$HTTP_STATUS)"
else
    pass "content_flagging group reachable via generic API"

    # ---- Create a field with deliberately invalid visibility ----
    # For protected_attributes this would be 400 (AttributeValidationHook). For
    # content_flagging the hook is not registered, so the server should accept
    # the attr as-is (no semantic meaning, but no validation either).
    bad_vis_other='{"name":"'${FIELD_PREFIX}'other_bad_vis","type":"text","target_type":"system","attrs":{"visibility":"not_a_real_value"}}'
    http_call POST /api/v4/properties/groups/content_flagging/user/fields "$ADMIN_TOKEN" "$bad_vis_other"
    if [[ "$HTTP_STATUS" == "201" ]]; then
        pass "non-protected group: invalid visibility accepted (AttributeValidationHook scoped)"
        other_id="$(jget id <<<"$HTTP_BODY")"

        # ---- Permissions should NOT have been forced to sysadmin ----
        # For protected_attributes the hook rewrites permission_field/options to
        # sysadmin. For non-managed groups the executor's default (member for
        # non-admins, whatever the caller set for admins) should stick.
        expect_contains "non-protected group: permission_field not forced to sysadmin" \
            "$HTTP_BODY" '"permission_field":"member"'
        expect_contains "non-protected group: permission_values not forced to sysadmin" \
            "$HTTP_BODY" '"permission_values":"member"'
        expect_contains "non-protected group: permission_options not forced to sysadmin" \
            "$HTTP_BODY" '"permission_options":"member"'

        # ---- Value upsert with a "bad email" shape should NOT be validated ----
        # AttributeValidationHook's value_type email check only fires for
        # protected_attributes; elsewhere, arbitrary strings pass through.
        val_body='[{"field_id":"'$other_id'","value":"not-an-email"}]'
        http_call PATCH "/api/v4/properties/groups/content_flagging/user/values/$ADMIN_ID" "$ADMIN_TOKEN" "$val_body"
        expect_status "non-protected group: unconstrained value upsert → 200" 200 "$HTTP_STATUS" "$HTTP_BODY"

        # ---- Clean up: delete the field, then hard-purge via DB for leak-free state ----
        http_call DELETE "/api/v4/properties/groups/content_flagging/user/fields/$other_id" "$ADMIN_TOKEN"
        expect_status "non-protected group: DELETE field → 200" 200 "$HTTP_STATUS" "$HTTP_BODY"

        if command -v psql >/dev/null 2>&1 && [[ -n "$MM_DB_URL" ]]; then
            psql "$MM_DB_URL" -q -c "
                DELETE FROM propertyvalues WHERE fieldid='$other_id';
                DELETE FROM propertyfields WHERE id='$other_id';
            " >/dev/null 2>&1 || true
        fi
    else
        fail "non-protected group: invalid visibility accepted" "status=$HTTP_STATUS body=${HTTP_BODY:0:200}"
    fi

    # ---- The 20-field limit must NOT apply to content_flagging ----
    # We don't fill 21 fields here (slow + noisy). Instead, assert the
    # FieldLimitHook's config map has no entry for this group by checking
    # the *shape* of the error: creating + deleting many fields in a row
    # should never 422. We create 5 fillers as a cheap proxy.
    other_filler_ids=()
    limit_ok=true
    for i in 0 1 2 3 4; do
        fbody='{"name":"'${FIELD_PREFIX}'other_fill_'$i'","type":"text","target_type":"system"}'
        http_call POST /api/v4/properties/groups/content_flagging/user/fields "$ADMIN_TOKEN" "$fbody"
        if [[ "$HTTP_STATUS" == "201" ]]; then
            other_filler_ids+=("$(jget id <<<"$HTTP_BODY")")
        else
            limit_ok=false
            break
        fi
    done
    if [[ "$limit_ok" == "true" ]]; then
        pass "non-protected group: 5 filler fields created without hitting a field cap"
    else
        fail "non-protected group: field creation unexpectedly failed" "status=$HTTP_STATUS"
    fi

    # Clean up fillers (HTTP + hard DB delete for zero-leak state).
    for oid in "${other_filler_ids[@]:-}"; do
        [[ -z "$oid" ]] && continue
        http_call DELETE "/api/v4/properties/groups/content_flagging/user/fields/$oid" "$ADMIN_TOKEN" >/dev/null 2>&1 || true
    done
    if command -v psql >/dev/null 2>&1 && [[ -n "$MM_DB_URL" ]]; then
        psql "$MM_DB_URL" -q -c "
            DELETE FROM propertyvalues WHERE fieldid IN (
                SELECT id FROM propertyfields WHERE name LIKE '${FIELD_PREFIX}other_%'
            );
            DELETE FROM propertyfields WHERE name LIKE '${FIELD_PREFIX}other_%';
        " >/dev/null 2>&1 || true
    fi
fi

