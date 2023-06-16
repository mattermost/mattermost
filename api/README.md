# Mattermost API Documentation

This repository holds the API reference available at [https://api.mattermost.com](https://api.mattermost.com).

The Mattermost API reference uses the [OpenAPI standard](https://openapis.org/) and the [ReDoc document generator](https://github.com/Rebilly/ReDoc).

All documentation is available under the terms of a [Creative Commons License](https://creativecommons.org/licenses/by-nc-sa/3.0/).

## Contributing

We're accepting pull requests! See something that could be documented better or is missing documentation? Make a PR and we'll gladly accept it.

All the documentation is written in YAML and found in the [v4/source](https://github.com/mattermost/mattermost-api-reference/tree/master/v4/source) directories. APIv4 documentation is in the [v4 directory](https://github.com/mattermost/mattermost-api-reference/tree/master/v4).
APIs for [Playbooks](https://github.com/mattermost/mattermost-plugin-playbooks) are retrieved from GitHub at build time and integrated into the final YAML file.

* When adding a new route, please add it to the correct file. For example, a channel route will go in [channels.yaml](https://github.com/mattermost/mattermost-api-reference/blob/master/v4/source/channels.yaml).
* To add a new tag, please do so in [introduction.yaml](https://github.com/mattermost/mattermost-api-reference/blob/master/v4/source/introduction.yaml)
* Definitions should be added to [definitions.yaml](https://github.com/mattermost/mattermost-api-reference/blob/master/v4/source/definitions.yaml)

There is no strict style guide but please try to follow the example of the existing documentation.

To build the full YAML, run `make build` and it will be output to `v4/html/static/mattermost-openapi-v4.yaml`. This will also check syntax using [swagger-cli](https://github.com/APIDevTools/swagger-cli).

To test locally, run `make build`, `make run` and navigate to `http://127.0.0.1:8080`. For any updates to the source files, re-run the same commands.

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/mattermost/mattermost-api-reference)

## Deployment

Deployment is handled automatically by our Jenkins CLI machine. When a pull request is merged it will automatically be deployed to [https://api.mattermost.com](https://api.mattermost.com).
