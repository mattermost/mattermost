-- Move the options of option-bearing property fields (select, multiselect,
-- rank, graph) out of the PropertyFields.Attrs->'options' JSON array and into
-- a table of their own.
--
-- Inside the blob an option is not individually addressable: it cannot be paged,
-- counted, or pointed at by a row-level relationship, and every edit rewrites
-- the whole array. As rows, options can be.
--
-- The externally visible shape does not change. PropertyFields reads re-coalesce
-- Attrs->'options' from these rows, so API and plugin responses carry options
-- inline exactly as before; the columns below exist to make that reconstruction
-- exact.

CREATE TABLE IF NOT EXISTS PropertyOptions (
    -- ID, Name, and Color are text rather than varchar(N) because the blob they
    -- are backfilled from was never length- or format-checked. Option IDs are
    -- generated identifiers on every path that validates them, but a caller
    -- writing an option list directly could and did use anything, and property
    -- values already point at those IDs -- so they are carried over as they are.
    -- A cap here would let the backfill below fail on data that is already
    -- persisted.
    ID text NOT NULL,
    GroupID varchar(26) NOT NULL,
    FieldID varchar(26) NOT NULL,
    -- Nullable, like Color, because an option in the blob did not have to carry a
    -- name key and a field has to read back the option object it was written
    -- with, key for key.
    Name text,
    Color text,
    -- Display rank of an option on a `rank`-typed field. bigint rather than int
    -- so that the range the backfill has to reject is a range no plausible rank
    -- falls in; anything it does reject stays in Attrs rather than failing.
    Rank bigint,
    -- Position the option held in the JSON array. Clients render options in
    -- array order, so that order is data and has to survive the move. Rewritten
    -- from the payload on every field write, so reordering the array reorders
    -- the rows.
    SortOrder int NOT NULL,
    -- Every key of the option object that has no column of its own. Options are
    -- open-shaped -- a plugin may attach anything to one -- so the leftovers are
    -- kept verbatim and merged back on read.
    Attrs jsonb,
    CreateAt bigint NOT NULL,
    UpdateAt bigint NOT NULL,
    DeleteAt bigint NOT NULL,
    -- An option is identified by its field and its ID, not by its ID alone.
    -- Options were previously per-field entries in a JSON array, where the same
    -- ID on two fields meant two different options -- which is exactly what
    -- unlinking a field from its template produces: the field takes over the
    -- options it was deriving, under the IDs its property values already point
    -- at, while the template keeps its own. Every lookup here is field-scoped
    -- anyway, so nothing needs an option ID to be unique on its own.
    PRIMARY KEY (FieldID, ID)
);

-- Backfill one row per option of every option-bearing field.
--
-- Options of fields whose type does not carry options are left in the blob
-- untouched: their contents were never validated or read, so they are not
-- necessarily option objects at all.
--
-- Ownership. A field that links to a template used to hold a byte-identical
-- copy of the template's options, same option IDs included. Those rows are
-- created once, owned by the template, and derived by the linked field at read
-- time -- hence the NOT EXISTS below, which drops a linked field's option only
-- when the template really does have an option with that ID. Anything else is
-- kept as an option owned by the linked field, and reported by the checks that
-- follow.
--
-- Column promotion. `id`, `name`, `color`, and `rank` become columns; every
-- other key stays in Attrs, so the merge on read reproduces the original object
-- key for key. `name`, `color`, and `rank` are promoted only when the JSON value
-- has the expected type, so an option carrying `"rank": "3"` keeps that string in
-- Attrs rather than being coerced into the Rank column.
--
-- Identity. Option IDs have to be unique within a field, which the blob did not
-- enforce -- nothing rejected an array holding the same ID twice, though only the
-- first was ever resolvable. The second occurrence is minted a fresh ID so the
-- option is kept rather than dropped, and reported by the postcondition check
-- below because nothing can reference it under its old ID.
--
-- The backfill and the postcondition checks following it run once, guarded by
-- a completion sentinel row in Systems, so re-executing this file against a
-- database it has already migrated changes nothing. An unguarded re-run would
-- not be one: the insert mints a fresh random ID for an option whose blob ID
-- is missing or already taken, and those rows conflict with nothing, so they
-- would be inserted again. The sentinel commits in the same transaction as
-- the rows it vouches for.
DO $$
DECLARE
    r record;
    divergent int := 0;
    unmatched int := 0;
BEGIN
    IF (SELECT COUNT(*) FROM Systems WHERE Name = 'PropertyOptionsBackfillComplete') = 0 THEN
WITH exploded AS (
    SELECT
        pf.ID AS fieldid,
        pf.GroupID AS groupid,
        NULLIF(pf.LinkedFieldID, '') AS sourceid,
        pf.CreateAt AS createat,
        pf.UpdateAt AS updateat,
        opt.value AS opt,
        opt.ordinality::int AS ord
    FROM PropertyFields pf
    CROSS JOIN LATERAL jsonb_array_elements(pf.Attrs->'options') WITH ORDINALITY AS opt(value, ordinality)
    WHERE pf.Type IN ('select', 'multiselect', 'rank', 'graph')
      AND jsonb_typeof(pf.Attrs->'options') = 'array'
      AND jsonb_typeof(opt.value) = 'object'
),
promoted AS (
    SELECT
        e.*,
        CASE WHEN jsonb_typeof(e.opt->'name') = 'string' THEN e.opt->>'name' END AS name,
        CASE WHEN jsonb_typeof(e.opt->'color') = 'string' THEN e.opt->>'color' END AS color,
        -- Only a whole number in the range the Rank column and its Go
        -- counterpart both hold exactly. A fraction or a larger magnitude would
        -- have to be rounded or wrapped, which would change the value the field
        -- reads back, so it stays in Attrs instead.
        CASE
            WHEN jsonb_typeof(e.opt->'rank') = 'number'
                 AND (e.opt->>'rank')::numeric BETWEEN -9007199254740992 AND 9007199254740992
                 AND (e.opt->>'rank')::numeric = trunc((e.opt->>'rank')::numeric)
            THEN (e.opt->>'rank')::bigint
        END AS rank
    FROM exploded e
),
-- Options a linked field only inherits are dropped here: the template's row
-- covers them.
owned AS (
    SELECT
        p.*,
        row_number() OVER (
            PARTITION BY p.fieldid, p.opt->>'id'
            ORDER BY p.ord
        ) AS idclaim
    FROM promoted p
    WHERE p.sourceid IS NULL
       OR NOT EXISTS (
            SELECT 1
            FROM PropertyFields src
            CROSS JOIN LATERAL jsonb_array_elements(src.Attrs->'options') AS sopt(value)
            WHERE src.ID = p.sourceid
              AND jsonb_typeof(src.Attrs->'options') = 'array'
              AND sopt.value->>'id' = p.opt->>'id'
       )
)
INSERT INTO PropertyOptions (ID, GroupID, FieldID, Name, Color, Rank, SortOrder, Attrs, CreateAt, UpdateAt, DeleteAt)
SELECT
    -- An option with no usable ID, or a second occurrence of one already used on
    -- the same field, is minted a new one. Nothing could reference it under an ID
    -- it does not hold, so the option is kept rather than dropped.
    CASE
        WHEN jsonb_typeof(o.opt->'id') = 'string' AND o.opt->>'id' <> '' AND o.idclaim = 1
        THEN o.opt->>'id'
        ELSE substr(md5(random()::text || clock_timestamp()::text || o.fieldid || o.ord::text), 1, 26)
    END,
    o.groupid,
    o.fieldid,
    o.name,
    o.color,
    o.rank,
    o.ord,
    NULLIF(
        o.opt - (
            ARRAY['id']
            || CASE WHEN o.name IS NOT NULL THEN ARRAY['name'] ELSE '{}'::text[] END
            || CASE WHEN o.color IS NOT NULL THEN ARRAY['color'] ELSE '{}'::text[] END
            || CASE WHEN o.rank IS NOT NULL THEN ARRAY['rank'] ELSE '{}'::text[] END
        ),
        '{}'::jsonb
    ),
    o.createat,
    o.updateat,
    0
FROM owned o;

-- Report anything the backfill could not treat as a clean copy. Both loops are
-- expected to find nothing; they exist because silence here would be
-- indistinguishable from data loss. RAISE WARNING reaches the PostgreSQL server
-- log (the Go driver does not forward notices), which is where an operator
-- investigating a divergence would look.
    FOR r IN
        SELECT po.FieldID AS fieldid, po.ID AS optionid, po.Name AS name, pf.LinkedFieldID AS sourceid
        FROM PropertyOptions po
        JOIN PropertyFields pf ON pf.ID = po.FieldID
        WHERE NULLIF(pf.LinkedFieldID, '') IS NOT NULL
        ORDER BY po.FieldID, po.SortOrder
    LOOP
        divergent := divergent + 1;
        IF divergent <= 50 THEN
            RAISE WARNING 'PropertyOptions backfill: option % (%) on field % is absent from its link source % and was kept as a local option owned by field %',
                r.optionid, r.name, r.fieldid, r.sourceid, r.fieldid;
        END IF;
    END LOOP;
    IF divergent > 0 THEN
        RAISE WARNING 'PropertyOptions backfill: % option(s) on linked fields diverged from their link source and are now owned locally', divergent;
    END IF;

    -- Postcondition: every option in a blob resolves to a row in the owning
    -- field's effective set under the ID it had. A miss means either the option
    -- was not carried over at all, or it was carried over under a minted ID
    -- because another field had claimed that one -- in both cases a property
    -- value pointing at the ID stops resolving.
    FOR r IN
        SELECT pf.ID AS fieldid, opt.value->>'id' AS optionid
        FROM PropertyFields pf
        CROSS JOIN LATERAL jsonb_array_elements(pf.Attrs->'options') AS opt(value)
        WHERE pf.Type IN ('select', 'multiselect', 'rank', 'graph')
          AND jsonb_typeof(pf.Attrs->'options') = 'array'
          AND jsonb_typeof(opt.value) = 'object'
          AND jsonb_typeof(opt.value->'id') = 'string'
          AND NOT EXISTS (
                SELECT 1
                FROM PropertyOptions po
                WHERE po.ID = opt.value->>'id'
                  AND po.FieldID IN (pf.ID, COALESCE(NULLIF(pf.LinkedFieldID, ''), pf.ID))
          )
    LOOP
        unmatched := unmatched + 1;
        IF unmatched <= 50 THEN
            RAISE WARNING 'PropertyOptions backfill: field % has no option row under id %; property values referencing that id will no longer resolve', r.fieldid, r.optionid;
        END IF;
    END LOOP;
    IF unmatched > 0 THEN
        RAISE WARNING 'PropertyOptions backfill: % option id(s) are no longer reachable from the field that used them', unmatched;
    END IF;

    INSERT INTO Systems VALUES('PropertyOptionsBackfillComplete', 'true');
    END IF;
END
$$;

-- The blob is left in place rather than stripped. Upgraded code reads and
-- writes options only through PropertyOptions: hydratePropertyFieldOptions
-- (property_field_options.go) deletes the options key from every field it
-- returns before repopulating it from these rows, and storedFieldAttrs (same
-- file) drops the key from every field write, so nothing upgraded ever reads
-- the blob back. A node still running pre-upgrade code has no such rewrite --
-- it reads option lists straight out of Attrs->'options' -- so stripping the
-- key here would make every select, multiselect and rank field look
-- optionless to it for as long as the upgrade takes to roll out. Leaving the
-- blob keeps that node serving the pre-upgrade list instead.
--
-- Accepted for the length of the upgrade window: an option edit made on an
-- upgraded node is invisible to one that has not upgraded, and a field write
-- from a not-yet-upgraded node is ignored by the upgraded ones. The fallback
-- also degrades field by field rather than staying in step -- storedFieldAttrs
-- rewrites the whole Attrs column, so the first write to a field from
-- upgraded code erases that field's blob. That is the consequence of choosing
-- not to dual-write, not an oversight.
--
-- The blob's removal is a migration of its own, in a later release, once
-- every supported node reads options from PropertyOptions.

-- Parent links between the options of a single property field.
--
-- A `graph`-typed field's options form a hierarchy rather than a flat list: an
-- option may have several parents and several children, and access rules ask
-- whether one option is at or above another. Each row here is one such link,
-- read in both directions -- upwards to find an option's ancestors, downwards to
-- find its descendants.
--
-- Both endpoints always belong to the field named in FieldID. An edge never
-- crosses fields, so a field's hierarchy is exactly the rows carrying its ID.

CREATE TABLE IF NOT EXISTS PropertyOptionEdges (
    FieldID varchar(26) NOT NULL,
    -- text, and not varchar(N), because that is what PropertyOptions.ID is: the
    -- option IDs these reference were backfilled from a JSON array that never
    -- length- or format-checked them.
    ChildOptionID text NOT NULL,
    ParentOptionID text NOT NULL,
    CreateAt bigint NOT NULL,
    -- An option is identified by (FieldID, ID), so an endpoint of an edge is
    -- too, and the same holds for the edge itself. Leading with FieldID also
    -- makes this index the one that walks upwards: given a set of children in a
    -- field, it finds their parents.
    PRIMARY KEY (FieldID, ChildOptionID, ParentOptionID)
);

-- No DeleteAt column: an edge is a link between two options rather than an
-- entity of its own, so re-parenting an option deletes rows outright, and
-- deleting an option deletes every edge it appears in. There is nothing a
-- tombstone would let a reader tell apart, and a soft-deleted edge would have to
-- be excluded by every traversal.
--
-- No foreign key to PropertyOptions either, matching the rest of this schema.
-- The store deletes an option's edges in the same transaction that deletes the
-- option.

-- The indexes come after the backfill: building each in one pass over the
-- populated table is cheaper than maintaining it across the insert, and inside
-- the migration's transaction there is no concurrent traffic CONCURRENTLY
-- would serve.

-- Load a field's live options in display order (also the keyset page key).
-- Deliberately no UNIQUE constraint: rank uniqueness is an application
-- invariant that may be relaxed.
CREATE INDEX IF NOT EXISTS idx_propertyoptions_fieldid_createat_id ON PropertyOptions (FieldID, CreateAt, ID) WHERE DeleteAt = 0;

-- Resolve a name within a field. Deliberately no UNIQUE constraint: name
-- uniqueness spans a field and its link source, so it cannot be expressed as a
-- single-table index.
CREATE INDEX IF NOT EXISTS idx_propertyoptions_fieldid_name ON PropertyOptions (FieldID, Name) WHERE DeleteAt = 0;

-- The downward walk, and the check that an option still has children (which is
-- what stops an interior option from being deleted).
--
-- FieldID leads for correctness, not just for selectivity: option IDs are not
-- unique across fields -- unlinking a field from its template deliberately
-- duplicates them, since the field takes over the options it was deriving under
-- the identifiers its property values already point at -- so a walk keyed on
-- ParentOptionID alone would pull in another field's edges. Every query here is
-- field-scoped, and the index has to lead with FieldID for that predicate to be
-- usable.
CREATE INDEX IF NOT EXISTS idx_propertyoptionedges_fieldid_parent_child ON PropertyOptionEdges (FieldID, ParentOptionID, ChildOptionID);

-- Both attribute views resolved option names out of the blob, so both are
-- redefined here or every policy referencing a select-style attribute starts
-- matching nothing. The jsonb_to_recordset over Attrs->'options' becomes a
-- lookup against PropertyOptions, scoped to the field's effective option set
-- -- its own rows plus those of its link source -- because a linked field no
-- longer holds a copy of the source's options. Soft-deleted options are
-- excluded, matching the blob, where removing an option removed it outright.
-- Select yields the option's name, multiselect an array of names in value
-- order, rank an object of name and rank.
--
-- A graph value gets a branch of its own rather than falling through to the
-- catch-all, which would project the stored value as it is. The branch yields
-- the identifiers of the live options the object holds, and always an array:
--
--   * Identifiers rather than names, because a rule over a hierarchy is
--     compiled against the identifiers of the options at or above the ones it
--     names, and identifiers survive an option being renamed.
--   * The held options only, with no ancestors mixed in, because that
--     at-or-above set is computed when the rule is compiled. The view never
--     has to walk PropertyOptionEdges.
--   * An array even when nothing is held, so a rule can apply an array
--     operator to it without testing the value's type first.

DROP MATERIALIZED VIEW IF EXISTS UserAttributeView;
DROP MATERIALIZED VIEW IF EXISTS ChannelAttributeView;

CREATE MATERIALIZED VIEW IF NOT EXISTS UserAttributeView AS
SELECT
    pv.GroupID,
    pv.TargetID,
    pv.TargetType,
    jsonb_object_agg(
        pf.Name,
        CASE
            WHEN pf.Type = 'select' THEN (
                SELECT to_jsonb(po.Name)
                FROM PropertyOptions po
                WHERE po.ID = pv.Value #>> '{}'
                  AND po.FieldID IN (pf.ID, COALESCE(NULLIF(pf.LinkedFieldID, ''), pf.ID))
                  AND po.DeleteAt = 0
                LIMIT 1
            )
            WHEN pf.Type = 'multiselect' AND jsonb_typeof(pv.Value) = 'array' THEN (
                SELECT jsonb_agg(po.Name)
                FROM jsonb_array_elements_text(pv.Value) AS option_id
                JOIN PropertyOptions po
                  ON po.ID = option_id
                 AND po.FieldID IN (pf.ID, COALESCE(NULLIF(pf.LinkedFieldID, ''), pf.ID))
                 AND po.DeleteAt = 0
            )
            WHEN pf.Type = 'rank' THEN (
                SELECT jsonb_build_object(
                    'name', po.Name,
                    'rank', po.Rank
                )
                FROM PropertyOptions po
                WHERE po.ID = pv.Value #>> '{}'
                  AND po.FieldID IN (pf.ID, COALESCE(NULLIF(pf.LinkedFieldID, ''), pf.ID))
                  AND po.DeleteAt = 0
                LIMIT 1
            )
            -- The identifiers the object holds, keeping only options that still
            -- exist. Scoped to the field's effective option set -- its own
            -- options plus those of the field it links to -- because a field
            -- that links to a template holds none of the options it serves.
            -- COALESCE, because an aggregate over no rows is NULL, and a JSON
            -- null here would be a third case for every rule to handle: an
            -- object that holds only deleted options holds nothing, so it
            -- projects an empty array.
            WHEN pf.Type = 'graph' AND jsonb_typeof(pv.Value) = 'array' THEN COALESCE((
                SELECT jsonb_agg(po.ID)
                FROM jsonb_array_elements_text(pv.Value) AS option_id
                JOIN PropertyOptions po
                  ON po.ID = option_id
                 AND po.FieldID IN (pf.ID, COALESCE(NULLIF(pf.LinkedFieldID, ''), pf.ID))
                 AND po.DeleteAt = 0
            ), '[]'::jsonb)
            -- A graph value that is not an array names no options. Projecting it
            -- as it is would hand a rule a value to compare instead of a set to
            -- intersect, so it projects as holding nothing.
            WHEN pf.Type = 'graph' THEN '[]'::jsonb
            ELSE pv.Value
        END
    ) AS Attributes
FROM PropertyValues pv
LEFT JOIN PropertyFields pf ON pf.ID = pv.FieldID
WHERE (pv.DeleteAt = 0 OR pv.DeleteAt IS NULL)
  AND (pf.DeleteAt = 0 OR pf.DeleteAt IS NULL)
  AND pf.ObjectType = 'user'
GROUP BY pv.GroupID, pv.TargetID, pv.TargetType;

CREATE MATERIALIZED VIEW IF NOT EXISTS ChannelAttributeView AS
SELECT
    pv.GroupID,
    pv.TargetID,
    pv.TargetType,
    jsonb_object_agg(
        pf.Name,
        CASE
            WHEN pf.Type = 'select' THEN (
                SELECT to_jsonb(po.Name)
                FROM PropertyOptions po
                WHERE po.ID = pv.Value #>> '{}'
                  AND po.FieldID IN (pf.ID, COALESCE(NULLIF(pf.LinkedFieldID, ''), pf.ID))
                  AND po.DeleteAt = 0
                LIMIT 1
            )
            WHEN pf.Type = 'multiselect' AND jsonb_typeof(pv.Value) = 'array' THEN (
                SELECT jsonb_agg(po.Name)
                FROM jsonb_array_elements_text(pv.Value) AS option_id
                JOIN PropertyOptions po
                  ON po.ID = option_id
                 AND po.FieldID IN (pf.ID, COALESCE(NULLIF(pf.LinkedFieldID, ''), pf.ID))
                 AND po.DeleteAt = 0
            )
            WHEN pf.Type = 'rank' THEN (
                SELECT jsonb_build_object(
                    'name', po.Name,
                    'rank', po.Rank
                )
                FROM PropertyOptions po
                WHERE po.ID = pv.Value #>> '{}'
                  AND po.FieldID IN (pf.ID, COALESCE(NULLIF(pf.LinkedFieldID, ''), pf.ID))
                  AND po.DeleteAt = 0
                LIMIT 1
            )
            -- As in UserAttributeView above: the identifiers the object holds,
            -- live options only, always an array.
            WHEN pf.Type = 'graph' AND jsonb_typeof(pv.Value) = 'array' THEN COALESCE((
                SELECT jsonb_agg(po.ID)
                FROM jsonb_array_elements_text(pv.Value) AS option_id
                JOIN PropertyOptions po
                  ON po.ID = option_id
                 AND po.FieldID IN (pf.ID, COALESCE(NULLIF(pf.LinkedFieldID, ''), pf.ID))
                 AND po.DeleteAt = 0
            ), '[]'::jsonb)
            WHEN pf.Type = 'graph' THEN '[]'::jsonb
            ELSE pv.Value
        END
    ) AS Attributes
FROM PropertyValues pv
LEFT JOIN PropertyFields pf ON pf.ID = pv.FieldID
WHERE (pv.DeleteAt = 0 OR pv.DeleteAt IS NULL)
  AND (pf.DeleteAt = 0 OR pf.DeleteAt IS NULL)
  AND pf.ObjectType = 'channel'
GROUP BY pv.GroupID, pv.TargetID, pv.TargetType;
