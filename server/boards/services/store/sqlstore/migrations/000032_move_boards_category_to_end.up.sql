{{- /* To move Boards category to to the last value, we just need a relatively large value. */ -}}
{{- /* Assigning 10x total number of categories works perfectly. The sort_order is anyways updated */ -}}
{{- /* when the user manually DNDs a category. */ -}}

{{if .postgres}}
UPDATE {{.prefix}}categories SET sort_order = (10 * (SELECT COUNT(*) FROM {{.prefix}}categories)) WHERE lower(name) = 'boards';
{{end}}

{{if .mysql}}
{{- /* MySQL doesn't allow referencing the same table in subquery and update query like Postgres, */ -}}
{{- /* So we save the subquery result in a variable to use later. */ -}}
SET @focalboard_numCategories = (SELECT COUNT(*) FROM {{.prefix}}categories);
UPDATE {{.prefix}}categories SET sort_order = (10 * @focalboard_numCategories) WHERE lower(name) = 'boards';
SET @focalboard_numCategories = NULL;
{{end}}
