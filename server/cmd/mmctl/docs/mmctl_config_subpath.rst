.. _mmctl_config_subpath:

mmctl config subpath
--------------------

Update client asset loading to use the configured subpath

Synopsis
~~~~~~~~


Update the hard-coded production client asset paths to take into account Mattermost running on a subpath. This command needs access to the Mattermost assets directory to be able to rewrite the paths.

::

  mmctl config subpath [flags]

Examples
~~~~~~~~

::

    # you can rewrite the assets to use a subpath
    mmctl config subpath --assets-dir /opt/mattermost/client --path /mattermost

    # the subpath can have multiple steps
    mmctl config subpath --assets-dir /opt/mattermost/client --path /my/custom/subpath

    # or you can fallback to the root path passing /
    mmctl config subpath --assets-dir /opt/mattermost/client --path /

Options
~~~~~~~

::

  -a, --assets-dir string   directory of the Mattermost assets in the local filesystem
  -h, --help                help for subpath
  -p, --path string         path to update the assets with

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

