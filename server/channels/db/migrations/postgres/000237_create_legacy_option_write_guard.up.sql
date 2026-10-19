-- Refuse option edits made the pre-000223 way, so that a server still running
-- 11.10 against this database fails the save visibly instead of appearing to
-- succeed.
--
-- 11.10 keeps a field's options in PropertyFields.Attrs->'options'. Upgraded
-- code keeps them in PropertyOptions and never reads that key back, so an
-- option an 11.10 server adds, renames, re-ranks or removes there is invisible
-- to every upgraded server and to AttributeView (000236) alike. A user given an
-- option that exists only in the blob ends up with no value for that attribute
-- once upgraded servers evaluate it, stops matching the policies that depend
-- on it, and can be removed from access-controlled channels by the membership
-- sync job -- damage that outlasts the upgrade.
--
-- Upgraded code never writes Attrs->'options' on an option-bearing field:
-- storedFieldAttrs (property_field_options.go) drops the key from every field
-- write, and nothing else that updates PropertyFields touches Attrs. So a write
-- that sets the key, or changes it, can only have come from an older server,
-- and that is the whole test:
--
--   * An insert carrying the key is refused.
--   * An update that leaves the key exactly as it was is allowed, so an 11.10
--     server can still rename a field or change its other settings while the
--     blob the upgrade left behind is still in place.
--   * An update that drops the key is allowed. That is what storedFieldAttrs
--     does to the blob on the first upgraded write, and what the migration that
--     eventually strips the blob everywhere will do.
--
-- Only option-bearing types are checked, because storedFieldAttrs only strips
-- the key from those: any other type keeps whatever Attrs it is written with.
--
-- Values are deliberately not guarded. A value write looks the same whichever
-- release made it, so a check there would bind upgraded servers too, and the
-- one bad state an 11.10 server can produce -- a value naming an option deleted
-- since the upgrade -- is one upgraded code already tolerates by design and
-- reads as unset.
--
-- 'MM001' is not a standard SQLSTATE, so the error cannot be mistaken for any
-- other failure. 11.10 does not recognize it and reports a generic save error;
-- the message reaches the server log.
--
-- Like AttributeView, this exists only for the upgrade window and is dropped
-- with it.

CREATE OR REPLACE FUNCTION reject_legacy_property_option_write() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.Attrs->'options' IS NOT DISTINCT FROM OLD.Attrs->'options' THEN
            RETURN NEW;
        END IF;
    END IF;

    RAISE EXCEPTION USING
        ERRCODE = 'MM001',
        MESSAGE = 'Attribute options cannot be changed by Mattermost servers older than v12.0. Make this change from a server running v12.0 or later.',
        DETAIL = format('PropertyField %s', NEW.ID);
END
$$ LANGUAGE plpgsql;

-- The WHEN clause keeps every write that carries no options key -- which is
-- every write upgraded code makes -- from calling the function at all. Firing
-- only on writes that name Attrs or Type spares the UpdateAt bumps and soft
-- deletes, which touch neither.
DROP TRIGGER IF EXISTS reject_legacy_property_option_write ON PropertyFields;
CREATE TRIGGER reject_legacy_property_option_write
    BEFORE INSERT OR UPDATE OF Attrs, Type ON PropertyFields
    FOR EACH ROW
    WHEN (NEW.Type IN ('select', 'multiselect', 'rank', 'graph') AND NEW.Attrs->'options' IS NOT NULL)
    EXECUTE FUNCTION reject_legacy_property_option_write();
