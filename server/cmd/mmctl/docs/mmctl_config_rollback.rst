.. _mmctl_config_rollback:

mmctl config rollback
---------------------

Roll back to a saved configuration

Synopsis
~~~~~~~~


Replaces the server configuration with a saved configuration from "config history". The configuration it replaces stays in the history.

It first lists the settings that rolling back would change and asks for confirmation, unless --confirm is given. With --dry-run, it only lists them.

Settings set through environment variables keep the values set there. Without --local, settings that can't be changed through the API and settings you don't have permission to change also keep their current values.

::

  mmctl config rollback <config-id> [flags]

Examples
~~~~~~~~

::

    config rollback hpgt7dw7si8odbc9gg938iqjhr
    config rollback hpgt7dw7si8odbc9gg938iqjhr --dry-run
    config rollback hpgt7dw7si8odbc9gg938iqjhr --confirm

Options
~~~~~~~

::

      --confirm   roll back without listing the settings that would change and asking for confirmation
      --dry-run   list the settings that would change without rolling back
  -h, --help      help for rollback

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

