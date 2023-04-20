{{ if or .postgres .mysql }}
    {{ dropColumnIfNeeded "category_boards" "delete_at" }}
{{end}}