.. _mmctl_health_export:

mmctl health export
-------------------

Export health findings as an HTML or Markdown report

Synopsis
~~~~~~~~


Export the server's latest health findings as an HTML or Markdown report to share, written to stdout or to the file given with --output. The report includes resolved and muted findings. --json can't be used with this command.

With --packet, evaluate a Support Packet on this machine instead. No server connection is needed.

::

  mmctl health export <html|md> [flags]

Examples
~~~~~~~~

::

    health export html --output health-report.html
    health export md --packet mm_support_packet.zip

Options
~~~~~~~

::

  -h, --help            help for export
  -o, --output string   File to write the report to, instead of stdout
      --packet string   Path to a Support Packet zip to evaluate without a server

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

