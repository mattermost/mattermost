.. _mmctl_import_process:

mmctl import process
--------------------

Start an import job

Synopsis
~~~~~~~~


Start an import job

::

  mmctl import process [importname] [flags]

Examples
~~~~~~~~

::

    import process 35uy6cwrqfnhdx3genrhqqznxc_import.zip

Options
~~~~~~~

::

      --bypass-upload     If this is set, the file is not processed from the server, but rather directly read from the filesystem. Works only in --local mode.
      --extract-content   If this is set, document attachments will be extracted and indexed during the import process. It is advised to disable it to improve performance. (default true)
  -h, --help              help for process

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

* `mmctl import <mmctl_import.rst>`_ 	 - Management of imports

