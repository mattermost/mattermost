-- Move the options of select-style property fields (select, multiselect, rank)
-- out of the PropertyFields.Attrs->'options' JSON array and into a table of
-- their own.
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

-- Serves the only two access patterns: load a field's live options in display
-- order (also the keyset page key), and resolve a name within a field.
-- Deliberately no UNIQUE constraint on either: name uniqueness spans a field
-- and its link source, so it cannot be expressed as a single-table index, and
-- rank uniqueness is an application invariant that may be relaxed.
CREATE INDEX IF NOT EXISTS idx_propertyoptions_fieldid_createat_id ON PropertyOptions (FieldID, CreateAt, ID) WHERE DeleteAt = 0;
CREATE INDEX IF NOT EXISTS idx_propertyoptions_fieldid_name ON PropertyOptions (FieldID, Name) WHERE DeleteAt = 0;

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
    WHERE pf.Type IN ('select', 'multiselect', 'rank')
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
DO $$
DECLARE
    r record;
    divergent int := 0;
    unmatched int := 0;
BEGIN
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
        WHERE pf.Type IN ('select', 'multiselect', 'rank')
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
END
$$;

-- The rows are now authoritative; drop the blob key so there is exactly one
-- place options live. Only for the types that were backfilled.
UPDATE PropertyFields
   SET Attrs = Attrs - 'options'
 WHERE Type IN ('select', 'multiselect', 'rank')
   AND Attrs->'options' IS NOT NULL;

-- Both attribute views resolved option names out of the blob, which is now
-- empty, so both have to be redefined here or every policy referencing a
-- select-style attribute starts matching nothing.
--
-- Two changes from the previous definitions. The jsonb_to_recordset over
-- Attrs->'options' becomes a lookup against PropertyOptions, and the lookup is
-- scoped to the field's effective option set -- its own rows plus those of its
-- link source -- because a linked field no longer holds a copy of the source's
-- options. Soft-deleted options are excluded, matching the blob, where removing
-- an option removed it outright. Each type's projection is otherwise unchanged:
-- select yields the option name, multiselect an array of names in value order,
-- rank an object of name and rank.
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
            ELSE pv.Value
        END
    ) AS Attributes
FROM PropertyValues pv
LEFT JOIN PropertyFields pf ON pf.ID = pv.FieldID
WHERE (pv.DeleteAt = 0 OR pv.DeleteAt IS NULL)
  AND (pf.DeleteAt = 0 OR pf.DeleteAt IS NULL)
  AND pf.ObjectType = 'channel'
GROUP BY pv.GroupID, pv.TargetID, pv.TargetType;
