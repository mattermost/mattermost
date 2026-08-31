-- Reverse 000195: strip the backfilled rank from each option, then flip the type
-- back to 'select'. Master's 'select' representation never stored a rank (the
-- option struct had no rank field, so it was dropped on save), so removing the
-- key restores the prior on-disk shape rather than leaving a stray rank behind.
-- 000197's down migration has already restored the distinct names by the time
-- this runs, so match on the original names.
UPDATE PropertyFields pf
SET Attrs = jsonb_set(
        pf.Attrs,
        '{options}',
        (
            SELECT jsonb_agg(elem.opt - 'rank' ORDER BY elem.ord)
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

UPDATE PropertyFields
SET Type = 'select'
WHERE Type = 'rank'
  AND GroupID = (SELECT ID FROM PropertyGroups WHERE Name = 'access_control')
  AND (
        (Name = 'classification'         AND ObjectType = 'template')
     OR (Name = 'system_classification'  AND ObjectType = 'system')
     OR (Name = 'channel_classification' AND ObjectType = 'channel')
  );
