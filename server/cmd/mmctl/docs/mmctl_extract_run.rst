.. _mmctl_extract_run:

mmctl extract run
-----------------

Start a content extraction job.

Synopsis
~~~~~~~~


Start a content extraction job.

::

  mmctl extract run [flags]

Examples
~~~~~~~~

::

    extract run

Options
~~~~~~~

::

      --from int   The timestamp of the earliest file to extract, expressed in seconds since the unix epoch.
  -h, --help       help for run
      --to int     The timestamp of the latest file to extract, expressed in seconds since the unix epoch. Defaults to the current time.

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

* `mmctl extract <mmctl_extract.rst>`_ 	 - Management of content extraction job.

