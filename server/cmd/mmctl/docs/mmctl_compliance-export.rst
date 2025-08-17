.. _mmctl_compliance-export:

mmctl compliance-export
-----------------------

Management of compliance exports

Synopsis
~~~~~~~~


Management of compliance exports

Options
~~~~~~~

::

  -h, --help   help for compliance-export

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
* `mmctl compliance-export cancel <mmctl_compliance-export_cancel.rst>`_ 	 - Cancel compliance export job
* `mmctl compliance-export create <mmctl_compliance-export_create.rst>`_ 	 - Create a compliance export job, of type 'csv' or 'actiance' or 'globalrelay'
* `mmctl compliance-export download <mmctl_compliance-export_download.rst>`_ 	 - Download compliance export file
* `mmctl compliance-export list <mmctl_compliance-export_list.rst>`_ 	 - List compliance export jobs, sorted by creation date descending (newest first)
* `mmctl compliance-export show <mmctl_compliance-export_show.rst>`_ 	 - Show compliance export job

