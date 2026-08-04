#!/bin/bash
set -euo pipefail

site_host="wison-knowledge-platform.wison.workers.dev"
site_url="https://${site_host}"
profile_dir="/Users/shiyuhe/Library/Application Support/Wison Knowledge Platform UAT"
trusted_ip="$(dig @8.8.8.8 +short A "${site_host}" | head -n 1)"

if [[ -z "${trusted_ip}" ]]; then
  trusted_ip="172.67.159.132"
fi

mkdir -p "${profile_dir}"
open -na "Google Chrome" --args \
  --user-data-dir="${profile_dir}" \
  --profile-directory="Default" \
  --host-resolver-rules="MAP ${site_host} ${trusted_ip}, EXCLUDE localhost" \
  "${site_url}"
