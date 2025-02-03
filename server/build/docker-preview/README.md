# Mattermost Docker Preview Image

This is a Docker image to install Mattermost in *Preview Mode* for exploring product functionality on a single machine using Docker.

Note: This configuration should not be used in production, as it’s using a known password string and contains other non-production configuration settings, and it does not support upgrade. If you’re looking for a production installation with Docker, please see the [Mattermost Production Docker Deployment Guide](https://docs.mattermost.com/install/install-docker.html#deploy-mattermost-on-docker-for-production-use).

To contribute, please see [Contribution Guidelines](https://developers.mattermost.com/contribute/more-info/getting-started/).

To file issues, [search for existing bugs and file a GitHub issue if your bug is new](https://developers.mattermost.com/contribute/why-contribute/#youve-found-a-bug).

## Usage

Please see [documentation for usage](http://docs.mattermost.com/install/docker-local-machine.html).

If you have Docker already set up, you can run this image in one line:

```
docker run --name mattermost-preview -d --publish 8065:8065 --add-host dockerhost:127.0.0.1 mattermost/mattermost-preview
```
