.. _mmctl_config_export:

mmctl config export
-------------------

Export the server configuration

Synopsis
~~~~~~~~


Export the server configuration in case you want to import somewhere else.

::

  mmctl config export [flags]

Examples
~~~~~~~~

::

  config export --remove-masked --remove-defaults

Options
~~~~~~~

::

  -h, --help              help for export
      --remove-defaults   remove default values from the exported configuration
      --remove-masked     remove masked values from the exported configuration (default true)

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

