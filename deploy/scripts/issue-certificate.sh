#!/bin/bash

usage() {
  cat <<EOF
Usage: $0 [-h] <-d DOMAIN> <-o PATH>

Options
  -h Print this help
  -o Output path (e.g. \${PWD}/certs)
  -d Domain certificate is issued for (e.g. mm.example.com)

EOF
}

issue_cert_standalone() {
  docker run -it --rm --name certbot -p 80:80 \
    -v "${1}/etc/letsencrypt:/etc/letsencrypt" \
    -v "${1}/lib/letsencrypt:/var/lib/letsencrypt" \
    certbot/certbot certonly --standalone -d "${2}"
}

authenticator_to_webroot() {
  sed -i 's/standalone/webroot/' "${1}"/etc/letsencrypt/renewal/"${2}".conf
  tee -a "${1}"/etc/letsencrypt/renewal/"${2}".conf >/dev/null <<EOF
webroot_path = /usr/share/nginx/html,
[[webroot_map]]
EOF
}

# become root (keeping environment) and make script executable
if [ $EUID != 0 ]; then
  chmod +x "$0"
  sudo -E ./"$0" "$@"
  exit $?
fi

while getopts d:o:h opt; do
  case "$opt" in
    d)
      domain=$OPTARG
      ;;
    o)
      output=$OPTARG
      ;;
    h)
      usage
      exit 0
      ;;
    \?)
      usage >&2
      exit 64
      ;;
  esac
done

shift $((OPTIND - 1))

if [ -z "$domain" ]; then
  echo "-d is required" >&2
  usage >&2
  exit 64
fi

if [ -z "$output" ]; then
  echo "-o is required" >&2
  usage >&2
  exit 64
fi

if ! which docker 1>/dev/null; then
  echo "Can't find Docker command" >&2
  exit 64
fi

issue_cert_standalone "${output}" "${domain}"
authenticator_to_webroot "${output}" "${domain}"
