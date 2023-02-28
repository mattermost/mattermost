{{if or .mysql .postgres}}
{{ addConstraintIfNeeded "category_boards" "unique_user_category_board" "UNIQUE" "UNIQUE(user_id, board_id)"}}
{{end}}
