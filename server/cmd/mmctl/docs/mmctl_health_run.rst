.. _mmctl_health_run:

mmctl health run
----------------

Run the health check now and report its findings

Synopsis
~~~~~~~~


Run the health check now, wait for it to finish, then report its findings as health check does. If a run is already pending or in progress, wait for that one instead of starting another.

::

  mmctl health run [flags]

Examples
~~~~~~~~

::

    health run
    health run --include-resolved --include-muted

Options
~~~~~~~

::

  -h, --help               help for run
      --include-muted      Include muted findings
      --include-resolved   Include resolved findings

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

* `mmctl health <mmctl_health.rst>`_ 	 - Inspect workspace health findings

