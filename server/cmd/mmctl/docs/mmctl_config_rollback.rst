.. _mmctl_config_rollback:

mmctl config rollback
---------------------

Roll back to a saved configuration

Synopsis
~~~~~~~~


Replaces the server configuration with a saved configuration from "config history". The configuration it replaces stays in the history.

Settings set through environment variables keep the values set there. Without --local, settings with sensitive values, such as passwords and database connection strings, settings that can't be changed through the API, settings you don't have permission to change, and the settings of plugins that aren't installed, or of all plugins while plugins are disabled, also keep their current values.

::

  mmctl config rollback <config-id> [flags]

Examples
~~~~~~~~

::

    config rollback hpgt7dw7si8odbc9gg938iqjhr

Options
~~~~~~~

::

  -h, --help   help for rollback

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

