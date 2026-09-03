-- Convert the classification-markings property fields from 'select' to 'rank'.
-- Each (Name, ObjectType) pair is matched explicitly so unrelated fields that
-- happen to share a name cannot be touched. At most three rows are updated.
UPDATE PropertyFields
SET Type = 'rank'
WHERE Type = 'select'
  AND GroupID = (SELECT ID FROM PropertyGroups WHERE Name = 'access_control')
  AND (
        (Name = 'classification'         AND ObjectType = 'template')
     OR (Name = 'system_classification'  AND ObjectType = 'system')
     OR (Name = 'channel_classification' AND ObjectType = 'channel')
  );

-- Backfill a rank onto every option. A 'rank' field requires each option to
-- carry a unique, positive integer rank, but the prior 'select' representation never
-- persisted one: the option struct had no rank field, so any rank the admin UI
-- sent was dropped on save. Without this backfill the type flip above would
-- leave an invalid rank field whose options all have a null rank.
--
-- The classification UI keeps its levels in severity order and writes the
-- options array in that order, so option position is the authoritative ordering.
-- We materialize rank from that position. ORDINALITY is 1-based, which matches
-- both the UI's `opt.rank ?? (i + 1)` fallback and the 1-based ranks in the
-- built-in presets, so a field configured from a preset is still recognized as
-- that preset after upgrade rather than collapsing to "Custom".
--
-- Only rows that actually carry a non-empty options array are touched (linked
-- system/channel fields may carry none). Run after the type flip in the same
-- migration so the field is never observable in the invalid (rank, null-rank)
-- state.
UPDATE PropertyFields pf
SET Attrs = jsonb_set(
        pf.Attrs,
        '{options}',
        (
            SELECT jsonb_agg(elem.opt || jsonb_build_object('rank', elem.ord) ORDER BY elem.ord)
            FROM jsonb_array_elements(pf.Attrs->'options') WITH ORDINALITY AS elem(opt, ord)
        )
    )
WHERE pf.Type = 'rank'
  AND pf.GroupID = (SELECT ID FROM PropertyGroups WHERE Name = 'access_control')
  AND (
        (pf.Name = 'classification'         AND pf.ObjectType = 'template')
     OR (pf.Name = 'system_classification'  AND pf.ObjectType = 'system')
     OR (pf.Name = 'channel_classification' AND pf.ObjectType = 'channel')
  )
  AND jsonb_typeof(pf.Attrs->'options') = 'array'
  AND jsonb_array_length(pf.Attrs->'options') > 0;
