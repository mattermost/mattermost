package assets

import "embed"

//go:embed *.yml **/*/*.yml .editorconfig
var Assets embed.FS
