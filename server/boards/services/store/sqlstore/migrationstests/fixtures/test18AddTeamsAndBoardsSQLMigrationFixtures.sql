INSERT INTO Channels (Id, CreateAt, UpdateAt, DeleteAt, TeamId, Type, Name, CreatorId) VALUES ('chan-id', 123, 123, 0, 'team-id', 'O', 'channel', 'user-id');

INSERT INTO focalboard_blocks
(id, workspace_id, root_id, parent_id, created_by, modified_by, type, title, create_at, update_at, delete_at, fields)
VALUES
('board-id', 'chan-id', 'board-id', 'board-id', 'user-id', 'user-id', 'board', 'My Board', 123, 123, 0, '{"columnCalculations": {"__title":"countUniqueValue"}}'),
('card-id', 'chan-id', 'board-id', 'board-id', 'user-id', 'user-id', 'card', 'A card', 123, 123, 0, '{}'),
('view-id', 'chan-id', 'board-id', 'board-id', 'user-id', 'user-id', 'view', 'A view', 123, 123, 0, '{"viewType":"table"}'),
('view-id2', 'chan-id', 'board-id', 'board-id', 'user-id', 'user-id', 'view', 'A view2', 123, 123, 0, '{"viewType":"board"}'),
('board-id2', 'chan-id', 'board-id2', 'board-id2', 'user-id', 'user-id', 'board', 'My Board Two', 123, 123, 0, '{"description": "My Description","showDescription":true,"isTemplate":true,"templateVer":1,"columnCalculations":[]}');
