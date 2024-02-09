.. _mmctl_user_preference_set:

mmctl user preference set
-------------------------

Set a specific user preference

Synopsis
~~~~~~~~


Set a specific user preference

::

  mmctl user preference set --category [category] --name [name] --value [value] [users] [flags]

Examples
~~~~~~~~

::

  preference set --category display_settings --name use_military_time --value true user@example.com

Options
~~~~~~~

::

  -c, --category string   The category of the preference
  -h, --help              help for set
  -n, --name string       The name of the preference
  -v, --value string      The value of the preference

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

* `mmctl user preference <mmctl_user_preference.rst>`_ 	 - Manage user preferences

