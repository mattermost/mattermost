{{- /* renameTableIfNeeded oldTableName newTableName string */ -}}
{{ renameTableIfNeeded "workspaces" "teams" }}

{{- /* renameColumnIfNeeded tableName oldColumnName newColumnName dataType */ -}}
{{ renameColumnIfNeeded "blocks" "workspace_id" "channel_id" "varchar(36)" }}
{{ renameColumnIfNeeded "blocks_history" "workspace_id" "channel_id" "varchar(36)" }}

{{- /* dropColumnIfNeeded tableName columnName */ -}}
{{ dropColumnIfNeeded "blocks" "workspace_id" }}
{{ dropColumnIfNeeded "blocks_history" "workspace_id" }}

{{- /* addColumnIfNeeded tableName columnName datatype constraint */ -}}
{{ addColumnIfNeeded "blocks" "board_id" "varchar(36)" ""}}
{{ addColumnIfNeeded "blocks_history" "board_id" "varchar(36)" ""}}

{{- /* cleanup incorrect data format in column calculations */ -}}
{{- /* then move from 'board' type to 'view' type*/ -}}
{{if .mysql}}
UPDATE {{.prefix}}blocks SET fields = JSON_SET(fields, '$.columnCalculations', JSON_OBJECT()) WHERE JSON_EXTRACT(fields, '$.columnCalculations') = JSON_ARRAY();

UPDATE {{.prefix}}blocks b
  JOIN (
    SELECT id, JSON_EXTRACT(fields, '$.columnCalculations') as board_calculations from {{.prefix}}blocks
    WHERE JSON_EXTRACT(fields, '$.columnCalculations') <> JSON_OBJECT()
  ) AS s on s.id = b.root_id
  SET fields = JSON_SET(fields, '$.columnCalculations', JSON_ARRAY(s.board_calculations))
  WHERE JSON_EXTRACT(b.fields, '$.viewType') = 'table'
  AND b.type = 'view';
{{end}}

{{if .postgres}}
UPDATE {{.prefix}}blocks SET fields = fields::jsonb - 'columnCalculations' || '{"columnCalculations": {}}' WHERE fields->>'columnCalculations' = '[]';

WITH subquery AS (
  SELECT id, fields->'columnCalculations' as board_calculations from {{.prefix}}blocks
  WHERE fields ->> 'columnCalculations' <> '{}')
UPDATE {{.prefix}}blocks b
    SET fields = b.fields::jsonb|| json_build_object('columnCalculations', s.board_calculations::jsonb)::jsonb
    FROM subquery AS s
    WHERE s.id = b.root_id
    AND b.fields ->> 'viewType' = 'table'
    AND b.type = 'view';
{{end}}

{{- /* TODO: Migrate the columnCalculations at app level and remove it from the boards and boards_history tables */ -}}


{{- /* add boards tables */ -}}
CREATE TABLE IF NOT EXISTS {{.prefix}}boards (
    id VARCHAR(36) NOT NULL PRIMARY KEY,

    {{if .postgres}}insert_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),{{end}}
	{{if .mysql}}insert_at DATETIME(6) NOT NULL DEFAULT NOW(6),{{end}}

    team_id VARCHAR(36) NOT NULL,
    channel_id VARCHAR(36),
    created_by VARCHAR(36),
    modified_by VARCHAR(36),
    type VARCHAR(1) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    icon VARCHAR(256),
    show_description BOOLEAN,
    is_template BOOLEAN,
    template_version INT DEFAULT 0,
    {{if .mysql}}
    properties JSON,
    card_properties JSON,
    {{end}}
    {{if .postgres}}
    properties JSONB,
    card_properties JSONB,
    {{end}}
    create_at BIGINT,
    update_at BIGINT,
    delete_at BIGINT
) {{if .mysql}}DEFAULT CHARACTER SET utf8mb4{{end}};

{{- /* createIndexIfNeeded tableName columns */ -}}
{{ createIndexIfNeeded "boards" "team_id, is_template" }}
{{ createIndexIfNeeded "boards" "channel_id" }}

CREATE TABLE IF NOT EXISTS {{.prefix}}boards_history (
    id VARCHAR(36) NOT NULL,

    {{if .postgres}}insert_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),{{end}}
	{{if .mysql}}insert_at DATETIME(6) NOT NULL DEFAULT NOW(6),{{end}}

    team_id VARCHAR(36) NOT NULL,
    channel_id VARCHAR(36),
    created_by VARCHAR(36),
    modified_by VARCHAR(36),
    type VARCHAR(1) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    icon VARCHAR(256),
    show_description BOOLEAN,
    is_template BOOLEAN,
    template_version INT DEFAULT 0,
    {{if .mysql}}
    properties JSON,
    card_properties JSON,
    {{end}}
    {{if .postgres}}
    properties JSONB,
    card_properties JSONB,
    {{end}}
    create_at BIGINT,
    update_at BIGINT,
    delete_at BIGINT,

    PRIMARY KEY (id, insert_at)
) {{if .mysql}}DEFAULT CHARACTER SET utf8mb4{{end}};


{{- /* migrate board blocks to boards table */ -}}
{{if .plugin}}
  {{if .postgres}}
  INSERT INTO {{.prefix}}boards (
      SELECT B.id, B.insert_at, C.TeamId, B.channel_id, B.created_by, B.modified_by, C.type,
                 COALESCE(B.title, ''),
                 COALESCE((B.fields->>'description')::text, ''),
                 B.fields->>'icon',
                 COALESCE((fields->'showDescription')::text::boolean, false),
                 COALESCE((fields->'isTemplate')::text::boolean, false),
                 COALESCE((B.fields->'templateVer')::text::int, 0),
                 '{}', B.fields->'cardProperties', B.create_at,
                 B.update_at, B.delete_at {{if doesColumnExist "boards" "minimum_role"}} ,'' {{end}}
          FROM {{.prefix}}blocks AS B
          INNER JOIN channels AS C ON C.Id=B.channel_id
          WHERE B.type='board'
  );
  INSERT INTO {{.prefix}}boards_history (
      SELECT B.id, B.insert_at, C.TeamId, B.channel_id, B.created_by, B.modified_by, C.type,
                 COALESCE(B.title, ''),
                 COALESCE((B.fields->>'description')::text, ''),
                 B.fields->>'icon',
                 COALESCE((fields->'showDescription')::text::boolean, false),
                 COALESCE((fields->'isTemplate')::text::boolean, false),
                 COALESCE((B.fields->'templateVer')::text::int, 0),
                 '{}', B.fields->'cardProperties', B.create_at,
                 B.update_at, B.delete_at {{if doesColumnExist "boards_history" "minimum_role"}} ,'' {{end}}
          FROM {{.prefix}}blocks_history AS B
          INNER JOIN channels AS C ON C.Id=B.channel_id
          WHERE B.type='board'
  );
  {{end}}
  {{if .mysql}}
  INSERT INTO {{.prefix}}boards (
      SELECT B.id, B.insert_at, C.TeamId, B.channel_id, B.created_by, B.modified_by, C.Type,
                 COALESCE(B.title, ''),
                 COALESCE(JSON_UNQUOTE(JSON_EXTRACT(B.fields,'$.description')), ''),
                 JSON_UNQUOTE(JSON_EXTRACT(B.fields,'$.icon')),
                 COALESCE(JSON_EXTRACT(B.fields, '$.showDescription'), 'false') = 'true',
                 COALESCE(JSON_EXTRACT(B.fields, '$.isTemplate'), 'false') = 'true',
                 COALESCE(JSON_EXTRACT(B.fields, '$.templateVer'), 0),
                 '{}', JSON_EXTRACT(B.fields, '$.cardProperties'), B.create_at,
                 B.update_at, B.delete_at {{if doesColumnExist "boards" "minimum_role"}} ,'' {{end}}
          FROM {{.prefix}}blocks AS B
          INNER JOIN Channels AS C ON C.Id=B.channel_id
          WHERE B.type='board'
  );
  INSERT INTO {{.prefix}}boards_history (
      SELECT B.id, B.insert_at, C.TeamId, B.channel_id, B.created_by, B.modified_by, C.Type,
                 COALESCE(B.title, ''),
                 COALESCE(JSON_UNQUOTE(JSON_EXTRACT(B.fields,'$.description')), ''),
                 JSON_UNQUOTE(JSON_EXTRACT(B.fields,'$.icon')),
                 COALESCE(JSON_EXTRACT(B.fields, '$.showDescription'), 'false') = 'true',
                 COALESCE(JSON_EXTRACT(B.fields, '$.isTemplate'), 'false') = 'true',
                 COALESCE(JSON_EXTRACT(B.fields, '$.templateVer'), 0),
                 '{}', JSON_EXTRACT(B.fields, '$.cardProperties'), B.create_at,
                 B.update_at, B.delete_at {{if doesColumnExist "boards_history" "minimum_role"}} ,'' {{end}}
          FROM {{.prefix}}blocks_history AS B
          INNER JOIN Channels AS C ON C.Id=B.channel_id
          WHERE B.type='board'
  );
  {{end}}
{{else}}
  {{if .postgres}}
  INSERT INTO {{.prefix}}boards (
      SELECT id, insert_at, '0', channel_id, created_by, modified_by, 'O',
                 COALESCE(B.title, ''),
                 COALESCE((fields->>'description')::text, ''),
                 B.fields->>'icon',
                 COALESCE((fields->'showDescription')::text::boolean, false),
                 COALESCE((fields->'isTemplate')::text::boolean, false),
                 COALESCE((B.fields->'templateVer')::text::int, 0),
                 '{}', fields->'cardProperties', create_at,
                 update_at, delete_at {{if doesColumnExist "boards" "minimum_role"}} ,'editor' {{end}}
          FROM {{.prefix}}blocks AS B
          WHERE type='board'
  );
  INSERT INTO {{.prefix}}boards_history (
      SELECT id, insert_at, '0', channel_id, created_by, modified_by, 'O',
                 COALESCE(B.title, ''),
                 COALESCE((fields->>'description')::text, ''),
                 B.fields->>'icon',
                 COALESCE((fields->'showDescription')::text::boolean, false),
                 COALESCE((fields->'isTemplate')::text::boolean, false),
                 COALESCE((B.fields->'templateVer')::text::int, 0),
                 '{}', fields->'cardProperties', create_at,
                 update_at, delete_at {{if doesColumnExist "boards_history" "minimum_role"}} ,'editor' {{end}}
          FROM {{.prefix}}blocks_history AS B
          WHERE type='board'
  );
  {{end}}

  {{if .mysql}}
  INSERT INTO {{.prefix}}boards (
      SELECT id, insert_at, '0', channel_id, created_by, modified_by, 'O',
                 COALESCE(B.title, ''),
                 COALESCE(JSON_UNQUOTE(JSON_EXTRACT(B.fields,'$.description')), ''),
                 JSON_UNQUOTE(JSON_EXTRACT(fields,'$.icon')),
                 COALESCE(JSON_EXTRACT(B.fields, '$.showDescription'), 'false') = 'true',
                 COALESCE(JSON_EXTRACT(B.fields, '$.isTemplate'), 'false') = 'true',
                 COALESCE(JSON_EXTRACT(B.fields, '$.templateVer'), 0),
                 '{}', JSON_EXTRACT(fields, '$.cardProperties'), create_at,
                 update_at, delete_at {{if doesColumnExist "boards" "minimum_role"}} ,'editor' {{end}}
          FROM {{.prefix}}blocks AS B
          WHERE type='board'
  );
  INSERT INTO {{.prefix}}boards_history (
      SELECT id, insert_at, '0', channel_id, created_by, modified_by, 'O',
                 COALESCE(B.title, ''),
                 COALESCE(JSON_UNQUOTE(JSON_EXTRACT(B.fields,'$.description')), ''),
                 JSON_UNQUOTE(JSON_EXTRACT(fields,'$.icon')),
                 COALESCE(JSON_EXTRACT(B.fields, '$.showDescription'), 'false') = 'true',
                 COALESCE(JSON_EXTRACT(B.fields, '$.isTemplate'), 'false') = 'true',
                 COALESCE(JSON_EXTRACT(B.fields, '$.templateVer'), 0),
                 '{}', JSON_EXTRACT(fields, '$.cardProperties'), create_at,
                 update_at, delete_at {{if doesColumnExist "boards_history" "minimum_role"}} ,'editor' {{end}}
          FROM {{.prefix}}blocks_history AS B
          WHERE type='board'
  );
  {{end}}
{{end}}


{{- /* Update block references to boards*/ -}}
UPDATE {{.prefix}}blocks SET board_id=root_id WHERE board_id IS NULL OR board_id='';
UPDATE {{.prefix}}blocks_history SET board_id=root_id WHERE board_id IS NULL OR board_id='';

{{- /* Remove boards, including templates */ -}}
DELETE FROM {{.prefix}}blocks WHERE type = 'board';
DELETE FROM {{.prefix}}blocks_history WHERE type = 'board';

{{- /* add board_members (only if boards_members doesn't already exist) */ -}}
{{if not (doesTableExist "board_members") }}
CREATE TABLE IF NOT EXISTS {{.prefix}}board_members (
    board_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    roles VARCHAR(64),
    scheme_admin BOOLEAN,
    scheme_editor BOOLEAN,
    scheme_commenter BOOLEAN,
    scheme_viewer BOOLEAN,
    PRIMARY KEY (board_id, user_id)
) {{if .mysql}}DEFAULT CHARACTER SET utf8mb4{{end}};

{{- /* if we're in plugin, migrate channel memberships to the board */ -}}
{{if .plugin}}
INSERT INTO {{.prefix}}board_members (
    SELECT B.Id, CM.UserId, CM.Roles, TRUE, TRUE, FALSE, FALSE
    FROM {{.prefix}}boards AS B
    INNER JOIN ChannelMembers as CM ON CM.ChannelId=B.channel_id
    WHERE CM.SchemeAdmin=True OR (CM.UserId=B.created_by)
);
{{end}}

{{- /* if we're in personal server or desktop, create memberships for everyone */ -}}
{{if and (not .plugin) (not .singleUser)}}
{{- /* for personal server, create a membership per user and board */ -}}
INSERT INTO {{.prefix}}board_members
     SELECT B.id, U.id, '', B.created_by=U.id, TRUE, FALSE, FALSE
       FROM {{.prefix}}boards AS B, {{.prefix}}users AS U;
{{end}}

{{if and (not .plugin) .singleUser}}
{{- /* for personal desktop, as we don't have users, create a membership */ -}}
{{- /* per board with a fixed user id */ -}}
INSERT INTO {{.prefix}}board_members
     SELECT B.id, 'single-user', '', TRUE, TRUE, FALSE, FALSE
       FROM {{.prefix}}boards AS B;
{{end}}
{{end}}

{{- /* createIndexIfNeeded tableName columns */ -}}
{{ createIndexIfNeeded "board_members" "user_id" }}
