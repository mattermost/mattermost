{{- /* delete old blocks PK and add id as the new one */ -}}
{{if .mysql}}
ALTER TABLE {{.prefix}}blocks DROP PRIMARY KEY;
ALTER TABLE {{.prefix}}blocks ADD PRIMARY KEY (id);
{{end}}

{{if .postgres}}
ALTER TABLE {{.prefix}}blocks DROP CONSTRAINT {{.prefix}}blocks_pkey1;
ALTER TABLE {{.prefix}}blocks ADD PRIMARY KEY (id);
{{end}}

{{- /* most block searches use board_id or a combination of board and parent ids */ -}}
{{ createIndexIfNeeded "blocks" "board_id, parent_id" }}

{{- /* get subscriptions is used once per board page load */ -}}
{{ createIndexIfNeeded "subscriptions" "subscriber_id" }}
