#!/usr/bin/env bash

echo "$(ls ~/)"

flatpak remote-delete fedora
flatpak remote-delete fedora-testing

flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo
