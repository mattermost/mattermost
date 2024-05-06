# Enterprise

This folder contains source available enterprise code as well as import directives for closed source enterprise code.

## Build Information

The source code in this folder is only included with builds specifying the `enterprise` or `sourceavailble` build tags. If you have a copy of https://github.com/mattermost/enterprise checked out as a peer to this repository, `enterprise` will be set automatically and the imports from both [`external_imports.go`](external_imports.go) and [`local_imports.go`](local_imports.go) will apply. 

In a development environment (when `BUILD_NUMBER` is left undefined or explicitly set to `dev`), the `sourceavailable` build tag will be set automatically and only the imports from [`local_imports.go`](local_imports.go) will apply.

## License

See the [LICENSE file](LICENSE) for license rights and limitations. See also [Mattermost Source Available License](https://docs.mattermost.com/overview/faq.html#mattermost-source-available-license) to learn more.

## Contributing

Contributions to source available enterprise code are welcome. Please see [CONTRIBUTING.md](../../CONTRIBUTING.md).
