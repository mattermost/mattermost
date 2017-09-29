# For maintainers only

## Responsibilities

Please go through this link [Maintainer Responsibility](https://gist.github.com/abperiasamy/f4d9b31d3186bbd26522)

### Making new releases
Edit `libraryVersion` constant in `api.go`.

```
$ grep libraryVersion api.go
      libraryVersion = "0.3.0"
```

Commit your changes
```
$ git commit -a -m "Bump to new release 0.3.0" --author "Minio Trusted <trusted@minio.io>"
```

Tag and sign your release commit, additionally this step requires you to have access to Minio's trusted private key.
```
$ export GNUPGHOME=/path/to/trusted/key
$ git tag -s 0.3.0
$ git push
$ git push --tags
```

### Announce
Announce new release by adding release notes at https://github.com/minio/minio-go/releases from `trusted@minio.io` account. Release notes requires two sections `highlights` and `changelog`. Highlights is a bulleted list of salient features in this release and Changelog contains list of all commits since the last release.

To generate `changelog`
```sh
git log --no-color --pretty=format:'-%d %s (%cr) <%an>' <latest_release_tag>..<last_release_tag>
```
