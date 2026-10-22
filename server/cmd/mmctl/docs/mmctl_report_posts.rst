.. _mmctl_report_posts:

mmctl report posts
------------------

Retrieve posts for reporting purposes

Synopsis
~~~~~~~~


Retrieve posts from a channel for reporting purposes. This command supports
pagination and can filter posts by time range. Results can be output in JSON format
for further processing.

::

  mmctl report posts [channel] [flags]

Examples
~~~~~~~~

::

    # Get posts from a channel with default settings
    mmctl report posts myteam:mychannel

    # Get posts with JSON output
    mmctl report posts myteam:mychannel --json

    # Get posts sorted by update_at in descending order
    mmctl report posts myteam:mychannel --time-field update_at --sort-direction desc

    # Get posts including deleted posts and metadata
    mmctl report posts myteam:mychannel --include-deleted --include-metadata

    # Get posts excluding ALL system posts
    mmctl report posts myteam:mychannel --exclude-system-posts

    # Get more posts per page (max 1000)
    mmctl report posts myteam:mychannel --per-page 500

    # Resume pagination from a specific cursor (use next_cursor from previous response)
    mmctl report posts myteam:mychannel --cursor "MTphYmMxMjM6Y3JlYXRlX2F0OmZhbHNlOmZhbHNlOmFzYzoxNjQwMDAwMzAwMDAwOnBvc3Qz"

Options
~~~~~~~

::

      --cursor string           Opaque cursor for pagination (use next_cursor from previous response)
      --exclude-system-posts    Exclude ALL system posts (any type starting with 'system_')
  -h, --help                    help for posts
      --include-deleted         Include deleted posts
      --include-metadata        Include file info, reactions, etc.
      --per-page int            Number of posts per page (max 1000) (default 100)
      --sort-direction string   Sort direction (asc or desc) (default "asc")
      --time-field string       Time field to use for sorting (create_at or update_at) (default "create_at")

Options inherited from parent commands
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

::

      --config string                path to the configuration file (default "$XDG_CONFIG_HOME/mmctl/config")
      --disable-pager                disables paged output
      --insecure-sha1-intermediate   allows to use insecure TLS protocols, such as SHA-1
      --insecure-tls-version         allows to use TLS versions 1.0 and 1.1
      --json                         the output format will be in json format
      --local                        allows communicating with the server through a unix socket
      --quiet                        prevent mmctl to generate output for the commands
      --strict                       will only run commands if the mmctl version matches the server one
      --suppress-warnings            disables printing warning messages

SEE ALSO
~~~~~~~~

* `mmctl report <mmctl_report.rst>`_ 	 - Reporting commands

