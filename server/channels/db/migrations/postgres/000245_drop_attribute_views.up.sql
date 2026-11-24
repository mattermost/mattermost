-- Attributes are read from PropertyValues, PropertyFields and PropertyOptions
-- directly (SqlAttributesStore), with 000223's projection, so the materialized
-- views and their refreshes are no longer needed.
--
-- The legacy AttributeView (000242) stays: servers from before 000216 read and
-- refresh it themselves.
DROP MATERIALIZED VIEW IF EXISTS UserAttributeView;
DROP MATERIALIZED VIEW IF EXISTS ChannelAttributeView;
