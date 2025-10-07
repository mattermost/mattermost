.. _mmctl_logs:

mmctl logs
----------

Display logs in a human-readable format

Synopsis
~~~~~~~~


Display logs in a human-readable format. As the logs format depends on the server, the "--format" flag cannot be used with this command.

::

  mmctl logs [flags]

Options
~~~~~~~

::

  -f, --follow       Fetch and watch logs.
  -h, --help         help for logs
  -l, --logrus       Use logrus for formatting.
  -n, --number int   Number of log lines to retrieve. (default 200)

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

