# IMPORTANT: Please make sure you have enough disk space available for the backups! 
Because it is more complicated to check the available disk space for various disk formatting options provided by different linux distributions, the script does currently not check for if there is enough disk space. 
Please check manually before executing this script!

## Upgrading Postgres

```
$ export PATH_TO_MATTERMOST_DOCKER=path/to/mattermost-docker
$ ./scripts/upgrade-postgres.sh
```

Environment variables for upgrading:
`ttf` means, the script 'tries to find' the environment variables. 

| Name | Description | Type | Default | Required |
|------|-------------|------|:---------:|:--------:|
| PATH_TO_MATTERMOST_DOCKER | absolute path to your mattermost-docker folder | `string` | n/a | yes |
| POSTGRES_USER | postgres user to connect to the mattermost database | `string` | ttf | yes |
| POSTGRES_PASSWORD | postgres password for the POSTGRES_USER to connect to the mattermost database | `string` | ttf | yes |
| POSTGRES_DB | postgres database name for the mattermost database | `string` | ttf | yes |
| POSTGRES_OLD_VERSION | postgres database old version which should be upgraded from | `semver` | ttf | yes |
| POSTGRES_NEW_VERSION | postgres database new version which should be upgraded to | `semver` | 13 | yes |
| POSTGRES_DOCKER_TAG | postgres docker tag found [here](https://hub.docker.com/_/postgres) including python3-dev | `string` | 13.2-alpine | yes |
| POSTGRES_OLD_DOCKER_FROM | FROM declaration in the postgres Dockerfile to be replaced | `string` | ttf | yes |
| POSTGRES_NEW_DOCKER_FROM | FROM declaration in the postgres Dockerfile replacing POSTGRES_OLD_DOCKER_FROM | `string` | ttf | yes |
| POSTGRES_UPGRADE_LINE | folder name required to upgrade postgres (Needs to match a folder [here](https://github.com/tianon/docker-postgres-upgrade)) | `string` | ttf | yes |
| MM_OLD_VERSION | mattermost old version which should be upgraded from | `semver` | ttf | yes |
| MM_NEW_VERSION | mattermost new version which should be upgraded to | `semver` | 5.32.1 | yes |

You can overwrite any of these variables before running this script with:
```
$ export VAR_NAME_FROM_ABOVE=yourValue
$ export PATH_TO_MATTERMOST_DOCKER=path/to/mattermost-docker
$ ./scripts/upgrade-postgres.sh
```
