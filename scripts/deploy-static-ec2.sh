#!/usr/bin/env bash
set -Eeuo pipefail

static_root="${1:?Static deployment root is required}"
release_id="${2:?Release ID is required}"
archive_path="${3:?Release archive path is required}"
health_url="${4:?Public health URL is required}"

fail() {
  printf 'Static deployment failed: %s\n' "$*" >&2
  exit 1
}

command -v tar >/dev/null 2>&1 || fail "tar is not installed on EC2"
command -v curl >/dev/null 2>&1 || fail "curl is not installed on EC2"
[[ "$static_root" =~ ^/[A-Za-z0-9._/-]+$ ]] || fail "static root has an invalid format"
[[ "$release_id" =~ ^[0-9a-f]{40}$ ]] || fail "release ID must be a full Git commit SHA"
[[ "$archive_path" =~ ^/tmp/mountreality-account-[0-9a-f]{40}\.tar\.gz$ ]] || fail "archive path is outside the expected temporary location"
[ -f "$archive_path" ] || fail "release archive was not uploaded"

releases_dir="$static_root/releases"
release_dir="$releases_dir/$release_id"
next_link="$static_root/current.next"
current_link="$static_root/current"
previous_release=""

if [ -L "$current_link" ]; then
  previous_release="$(readlink -f "$current_link")"
  case "$previous_release" in
    "$releases_dir"/*) ;;
    *) previous_release="" ;;
  esac
fi

mkdir -p "$release_dir"
tar -xzf "$archive_path" -C "$release_dir"
[ -f "$release_dir/index.html" ] || fail "release does not contain index.html"

ln -sfn "$release_dir" "$next_link"
mv -Tf "$next_link" "$current_link"
rm -f "$archive_path"

printf 'Waiting for %s...\n' "$health_url"
for attempt in $(seq 1 20); do
  if curl --fail --silent --show-error --max-time 5 "$health_url" >/dev/null; then
    mapfile -t expired_releases < <(
      find "$releases_dir" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %f\n' \
        | sort -nr \
        | awk 'NR > 5 { print $2 }'
    )
    for expired_name in "${expired_releases[@]}"; do
      [[ "$expired_name" =~ ^[0-9a-f]{40}$ ]] || continue
      expired_path="$releases_dir/$expired_name"
      [ "$expired_path" = "$release_dir" ] || rm -rf -- "$expired_path"
    done
    printf 'Account frontend release %s is live.\n' "${release_id:0:12}"
    exit 0
  fi
  sleep 2
done

if [ -n "$previous_release" ] && [ -f "$previous_release/index.html" ]; then
  ln -sfn "$previous_release" "$next_link"
  mv -Tf "$next_link" "$current_link"
  printf 'Rolled back to the previous account frontend release.\n' >&2
fi

fail "public health check did not pass after 40 seconds"
