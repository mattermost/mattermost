-- Delete everything that belongs to the post_attributes property group: its
-- values, option edges, options, fields (PropertyFieldGrants cascade with the
-- fields through their foreign key) and the group row itself.
DELETE FROM PropertyValues
 WHERE GroupID IN (SELECT ID FROM PropertyGroups WHERE Name = 'post_attributes');

DELETE FROM PropertyOptionEdges
 WHERE FieldID IN (
    SELECT f.ID
      FROM PropertyFields f
      JOIN PropertyGroups g ON g.ID = f.GroupID
     WHERE g.Name = 'post_attributes'
 );

DELETE FROM PropertyOptions
 WHERE GroupID IN (SELECT ID FROM PropertyGroups WHERE Name = 'post_attributes');

DELETE FROM PropertyFields
 WHERE GroupID IN (SELECT ID FROM PropertyGroups WHERE Name = 'post_attributes');

DELETE FROM PropertyGroups WHERE Name = 'post_attributes';
