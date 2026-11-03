.. _mmctl_logs:

mmctl logs
----------

Display logs in a human-readable format

Synopsis
~~~~~~~~


Display logs in a human-readable format. As the logs format depends on the server, the "--format" flag cannot be used with this command.

The logs are read from every node of the cluster, and filtered on each node. This needs the server to write its log file in JSON format (LogSettings.FileJson). Use "--plain" to read the raw log lines instead, as earlier versions of mmctl did.

Entries are colored when printed to a terminal. Set NO_COLOR to turn the colors off, or CLICOLOR_FORCE to keep them when the output is piped.

::

  mmctl logs [flags]

Examples
~~~~~~~~

::

    # print the last 200 entries of each node
    $ mmctl logs

    # keep printing new error and warning entries until interrupted
    $ mmctl logs --follow --level error,warn

    # follow the entries of a single request, by its request ID
    $ mmctl logs -f --search 8xyz7gqnfjb1jrkpd5xnqk5mbo

    # print what a node logged in the last 15 minutes
    $ mmctl logs --node node-1 --since 15m

Options
~~~~~~~

::

  -f, --follow              Keep polling the server and print new log entries until interrupted.
  -h, --help                help for logs
      --interval duration   How often to poll for new log entries with --follow. At least 2s. (default 5s)
      --level strings       Only show entries of these level groups: error, warn, info, debug.
      --node stringArray    Only show the logs of this cluster node. Can be repeated.
  -n, --number int          Number of log entries to retrieve initially, per node. At most 10000. (default 200)
      --plain               Print the raw log lines of every node. Supports none of --follow, --level, --node, --search and --since.
  -s, --search string       Only show entries with a value, other than the level and timestamp, that contains this text, ignoring case.
      --since duration      Only show entries logged within this duration, e.g. 15m.

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

* `mmctl <mmctl.rst>`_ 	 - Remote client for the Open Source, self-hosted Slack-alternative

