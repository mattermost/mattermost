.. _mmctl_config_history:

mmctl config history
--------------------

List saved configurations

Synopsis
~~~~~~~~


Lists the configurations saved by the server, newest first, with the settings that changed in each one. The server keeps this history only when its configuration is stored in the database.

Sensitive values are always hidden.

::

  mmctl config history [flags]

Examples
~~~~~~~~

::

    config history
    config history --detailed
    config history --page 1 --per-page 20

Options
~~~~~~~

::

      --detailed       Show the old and new value of each changed setting
  -h, --help           help for history
      --page int       Page number to fetch for the list of saved configurations
      --per-page int   Number of saved configurations to be fetched (default 10)

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

* `mmctl config <mmctl_config.rst>`_ 	 - Configuration

