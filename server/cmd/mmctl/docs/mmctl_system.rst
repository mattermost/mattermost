.. _mmctl_system:

mmctl system
------------

System management

Synopsis
~~~~~~~~


System management commands for interacting with the server state and configuration.

Options
~~~~~~~

::

  -h, --help   help for system

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

* `mmctl <mmctl.rst>`_ 	 - Remote client for the Open Source, self-hosted Slack-alternative
* `mmctl system clearbusy <mmctl_system_clearbusy.rst>`_ 	 - Clears the busy state
* `mmctl system getbusy <mmctl_system_getbusy.rst>`_ 	 - Get the current busy state
* `mmctl system setbusy <mmctl_system_setbusy.rst>`_ 	 - Set the busy state to true
* `mmctl system status <mmctl_system_status.rst>`_ 	 - Prints the status of the server
* `mmctl system version <mmctl_system_version.rst>`_ 	 - Prints the remote server version

