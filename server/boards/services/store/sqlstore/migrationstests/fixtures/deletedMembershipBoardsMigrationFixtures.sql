INSERT INTO Teams
(Id, Name, Type, DeleteAt)
VALUES
('team-one', 'team-one', 'O', 0),
('team-two', 'team-two', 'O', 0),
('team-three', 'team-three', 'O', 0);

INSERT INTO Channels
(Id, DeleteAt, TeamId, Type, Name, CreatorId)
VALUES
('group-channel', 0, 'team-one', 'G', 'group-channel', 'user-one'),
('direct-channel', 0, 'team-one', 'D', 'direct-channel', 'user-one');

INSERT INTO Users
(Id, Username, Email)
VALUES
('user-one', 'john-doe', 'john-doe@sample.com'),
('user-two', 'jane-doe', 'jane-doe@sample.com');

INSERT INTO focalboard_boards
(id, team_id, channel_id, created_by, modified_by, type, title, description, icon, show_description, is_template, create_at, update_at, delete_at)
VALUES
('board-group-channel', 'team-one', 'group-channel', 'user-one', 'user-one', 'P', 'Group Channel Board', '', '', false, false, 123, 123, 0),
('board-direct-channel', 'team-one', 'direct-channel', 'user-one', 'user-one', 'P', 'Direct Channel Board', '', '', false, false, 123, 123, 0);

INSERT INTO focalboard_board_members
(board_id, user_id, scheme_admin)
VALUES
('board-group-channel', 'user-one', true),
('board-direct-channel', 'user-one', true);

INSERT INTO TeamMembers
(TeamId, UserId, DeleteAt, SchemeAdmin)
VALUES
('team-one', 'user-one', 123, true),
('team-one', 'user-two', 123, true),
('team-two', 'user-one', 123, true),
('team-two', 'user-two', 123, true),
('team-three', 'user-one', 0, true),
('team-three', 'user-two', 0, true);

INSERT INTO ChannelMembers
(ChannelId, UserId, SchemeUser, SchemeAdmin)
VALUES
('group-channel', 'user-one', true, true),
('group-channel', 'two-one', true, false),
('direct-channel', 'user-one', true, true);
