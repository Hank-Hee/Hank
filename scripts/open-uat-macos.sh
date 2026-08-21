#!/bin/bash
set -euo pipefail

site_host="wison-knowledge-platform.wison.workers.dev"
site_url="https://${site_host}"
team_url="https://849943802.cloudflareaccess.com/"
profile_dir="/Users/shiyuhe/Library/Application Support/Wison Knowledge Platform UAT"
trusted_ip="$(dig @8.8.8.8 +time=1 +tries=1 +short A "${site_host}" 2>/dev/null | head -n 1 || true)"
target_url="${1:-${site_url}}"

case "${target_url}" in
  "${site_url}"*|"${team_url}"*) ;;
  *)
    echo "Refusing to open an untrusted URL." >&2
    exit 1
    ;;
esac

if [[ ! "${trusted_ip}" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  trusted_ip="172.67.159.132"
fi

mkdir -p "${profile_dir}"
open -na "Google Chrome" --args \
  --user-data-dir="${profile_dir}" \
  --profile-directory="Default" \
  --host-resolver-rules="MAP ${site_host} ${trusted_ip}, EXCLUDE localhost" \
  "${target_url}"
