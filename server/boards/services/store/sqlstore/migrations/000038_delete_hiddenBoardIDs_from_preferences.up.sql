{{if .plugin}}
    DELETE FROM Preferences WHERE category = 'focalboard' AND name = 'hiddenBoardIDs';
{{else}}
    DELETE FROM {{.prefix}}preferences WHERE category = 'focalboard' AND name = 'hiddenBoardIDs';
{{end}}