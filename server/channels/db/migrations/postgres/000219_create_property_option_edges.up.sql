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

-- No DeleteAt column: an edge is a link between two options rather than an
-- entity of its own, so re-parenting an option deletes rows outright, and
-- deleting an option deletes every edge it appears in. There is nothing a
-- tombstone would let a reader tell apart, and a soft-deleted edge would have to
-- be excluded by every traversal.
--
-- No foreign key to PropertyOptions either, matching the rest of this schema.
-- The store deletes an option's edges in the same transaction that deletes the
-- option.
