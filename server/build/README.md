## About this folder

This folder contains some files that we use to build the `mattermost-server` and other files like privacy policy and licenses.

The `Dockerfile` in this folder (`Dockerfile.buildenv`) is the build environment for our current builds you can find the docker image to download [here](https://hub.docker.com/r/mattermost/mattermost-build-server/tags/) or build your own.



### Docker Image for building the Server

We have a docker image to build `mattermost-server` and it is based on Go docker image.

#### Current Tag Format

Images are published with multiple tags for flexibility:

| Tag Format | Example | Use Case |
|------------|---------|----------|
| `go-<GO>-node-<NODE>` | `go-1.24.11-node-20.11` | Full version specification |
| `go-<GO>` | `go-1.24.11` | When you only care about Go version |

Examples:
```bash
# Full specification (includes both Go and Node)
docker pull mattermost/mattermost-build-server:go-1.24.11-node-20.11

# Go version only (same image, alternative tag)
docker pull mattermost/mattermost-build-server:go-1.24.11
```

FIPS images follow the same pattern with `-fips` suffix:
```bash
docker pull mattermost/mattermost-build-server-fips:go-1.24.11-node-20.11
docker pull mattermost/mattermost-build-server-fips:go-1.24.11
```

The versions are sourced from:
- Go version: `server/.go-version`
- Node version: `.nvmrc`

#### Base Image Dependency

The build server image depends on [`mattermost/golang-bullseye`](https://hub.docker.com/r/mattermost/golang-bullseye), which is built from the [mattermost/golang-bullseye](https://github.com/mattermost/golang-bullseye) repository.

**When upgrading Go version**, follow this order:
1. **First**: Update `mattermost/golang-bullseye` repository
   - Update the Go version as per README instruction
   - Merge then wait for the image to be published to Docker Hub
2. **Then**: Update this repository
   - Update `server/.go-version` with the new version
   - Merge to master to trigger the build server image workflow

If you try to build the build server image before the base `golang-bullseye` image exists, the build will fail.

#### When Images Are Published

Images are automatically built and published to Docker Hub via the [BuildEnv Docker Image workflow](/.github/workflows/build-server-image.yml).

**Automatic publishing** occurs on merge to `master` when any of these files change:
- `server/build/Dockerfile.buildenv`
- `server/build/Dockerfile.buildenv-fips`
- `server/.go-version`
- `.nvmrc`
- `.github/workflows/build-server-image.yml`

**Manual publishing** can be triggered via GitHub Actions:
1. Go to Actions > "BuildEnv Docker Image" > "Run workflow"
2. Optionally specify `GO_VERSION` and/or `NODE_VERSION`
3. If left empty, versions are read from the source files

Pull requests will build and test the image but will not publish to Docker Hub.

#### Release Branch Images

| Release | Go Version | Node Version | Image Tag |
|---------|------------|--------------|-----------|
| 11.4 | 1.24.11 | 20.11 | `go-1.24.11-node-20.11` or `go-1.24.11` |
| 11.3 | 1.24.6 | 20.11 | `go-1.24.6-node-20.11` or `go-1.24.6` |
| 11.2 | 1.24.6 | 20.11 | `go-1.24.6-node-20.11` or `go-1.24.6` |
| 11.1 | 1.24.6 | 20.11 | `go-1.24.6-node-20.11` or `go-1.24.6` |
| 11.0 | 1.24.6 | 20.11 | `go-1.24.6-node-20.11` or `go-1.24.6` |
| 10.12 | 1.24.6 | 20.11 | `go-1.24.6-node-20.11` or `go-1.24.6` |
| 10.11 | 1.24.6 | 20.11 | `go-1.24.6-node-20.11` or `go-1.24.6` |

#### Legacy Images (Historical Reference)

In our Docker Hub Repository we have the following legacy images:

- `mattermost/mattermost-build-server:dec-7-2018` which is based on Go 1.11 you can use for MM versions <= `5.8.0`
- `mattermost/mattermost-build-server:feb-28-2019` which is based on Go 1.12 you can use for MM versions >= `5.9.0` <= `5.15.0`
- `mattermost/mattermost-build-server:sep-17-2019` which is based on Go 1.12.9 you can use for MM versions >= `5.16.0`
- `mattermost/mattermost-build-server:20200322_golang-1.14.1` which is based on Go 1.14.1 you can use for MM versions >= `5.24.x`
- `mattermost/mattermost-build-server:20201023_golang-1.14.6` which is based on Go 1.14.6 you can use for MM versions >= `5.25.x`
- `mattermost/mattermost-build-server:20201119_golang-1.15.5` which is based on Go 1.15.5 you can use for MM versions >= `5.26.x` to `5.37.x`
- `mattermost/mattermost-build-server:20210810_golang-1.16.7` which is based on Go 1.16.X you can use for MM versions >= `5.38.x`
