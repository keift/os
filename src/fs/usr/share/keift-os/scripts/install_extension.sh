#!/usr/bin/env bash

id="${1:-}"
shell_version=$(gnome-shell --version | cut -f 3 -d " ")

data=$(curl -fsSL --max-time 10 "https://extensions.gnome.org/extension-info?uuid=${id}&shell_version=${shell_version}")

download_url=$(jq -r ".download_url" <<< "${data}")

wget -O /tmp/"${id}".zip https://extensions.gnome.org"${download_url}"

mkdir -p /usr/share/gnome-shell/extensions

unzip -d /usr/share/gnome-shell/extensions/"${id}" /tmp/"${id}".zip

rm -f /tmp/"${id}".zip

glib-compile-schemas /usr/share/gnome-shell/extensions/"${id}"/schemas

chmod -R a+rX /usr/share/gnome-shell/extensions/"${id}"
