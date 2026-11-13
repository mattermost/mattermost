.. _mmctl_health_check:

mmctl health check
------------------

Report current health findings

Synopsis
~~~~~~~~


Report the findings of the server's latest health evaluation. By default only firing findings and findings that could not be evaluated are shown.

With --packet, evaluate a Support Packet on this machine instead. No server connection is needed, and findings meant for support engineers are included.

::

  mmctl health check [flags]

Examples
~~~~~~~~

::

    health check
    health check --include-resolved --include-muted
    health check --packet mm_support_packet.zip

Options
~~~~~~~

::

  -h, --help               help for check
      --include-muted      Include muted findings
      --include-resolved   Include resolved findings
      --packet string      Path to a Support Packet zip to evaluate offline, without a server

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

