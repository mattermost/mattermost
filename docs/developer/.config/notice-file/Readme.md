# Notice.txt File Configuration

We are automatically generating Notice.txt by using first-level dependencies of the project. The related pipeline uses `config.yaml` stored in this folder.


## Pipfile configuration
For every dependency please add `# Repo: https://github.com/owner/repo` url. Sample:

```
# Add a "copy" button to code blocks in Sphinx (https://sphinx-copybutton.readthedocs.io/en/latest/)
# Repo: https://github.com/executablebooks/sphinx-copybutton
sphinx-copybutton = "0.5.0"
```

## Configuration

Sample:

```
title: "Mattermost Documentation Sphinx Extensions"
copyright: "©2022 Mattermost, Inc.  All Rights Reserved.  See LICENSE.txt for license information."
description: "This document includes a list of open source components used in Mattermost Documentation Sphinx Extensions, including those that have been modified."
search:
  - "Pipfile"
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
| search | array | Pipeline will search for Pipfiles files mentioned here. Globstar format is supported ie. `**/Pipfile`. |
