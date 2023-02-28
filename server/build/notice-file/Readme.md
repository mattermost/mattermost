# Notice.txt File Configuration

We are automatically generating Notice.txt by using first-level dependencies of the project. The related pipeline uses `config.yaml` stored in this folder.


## Configuration

Sample:

```
title: "Mattermost Playbooks"
copyright: "©2015-present Mattermost, Inc.  All Rights Reserved.  See LICENSE for license information."
description: "This document includes a list of open source components used in Mattermost Playbooks, including those that have been modified."
search:
  - "go.mod"
  - "client/go.mod"
dependencies: []
devDependencies: []
```

| Field | Type   | Purpose |
| :--   | :--    | :--     |
| title | string | Field content will be used as a title of the application. See first line of `NOTICE.txt` file. |
| copyright | string | Field content will be used as a copyright message. See second line of `NOTICE.txt` file. |
| description | string | Field content will be used as notice file description. See third line of `NOTICE.txt` file. |
| dependencies | array | If any dependency name mentioned, it will be automatically added even if it is not a first-level dependency. |
| devDependencies | array | If any dependency name mentioned, it will be added when it is referenced in devDependency section. |
| search | array | Pipeline will search for package.json/go.mod files mentioned here. Globstar format is supported ie. `x/**/go.mod`. |
