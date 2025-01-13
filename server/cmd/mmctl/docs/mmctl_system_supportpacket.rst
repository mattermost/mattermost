.. _mmctl_system_supportpacket:

mmctl system supportpacket
--------------------------

Download a Support Packet

Synopsis
~~~~~~~~


Generate and download a Support Packet of the server to share it with Mattermost Support

::

  mmctl system supportpacket [flags]

Examples
~~~~~~~~

::

    system supportpacket

Options
~~~~~~~

::

  -h, --help                 help for supportpacket
  -o, --output-file string   Define the output file name

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

* `mmctl system <mmctl_system.rst>`_ 	 - System management

