.. _mmctl_config_reset:

mmctl config reset
------------------

Reset config setting

Synopsis
~~~~~~~~


Resets the value of a config setting by its name in dot notation or a setting section. Accepts multiple values for array settings.

::

  mmctl config reset [flags]

Examples
~~~~~~~~

::

  config reset SqlSettings.DriverName LogSettings

Options
~~~~~~~

::

      --confirm   confirm you really want to reset all configuration settings to its default value
  -h, --help      help for reset

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

