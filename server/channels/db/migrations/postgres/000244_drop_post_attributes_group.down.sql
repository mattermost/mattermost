-- Nothing to undo: the up migration deleted the post_attributes rows, and they
-- cannot be reconstructed. The group is deliberately not recreated here; a
-- downgraded server registers it again, empty, when it starts. The post fields
-- moved from member to creator stay at creator.
SELECT 1;
