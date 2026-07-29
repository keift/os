#!/usr/bin/env bash

flatpak remote-delete fedora || true
flatpak remote-delete fedora-testing || true

flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo || true

flatpak install -y flathub org.gnome.Calculator || true
flatpak install -y flathub org.gnome.Calendar || true
flatpak install -y flathub org.gnome.clocks || true
flatpak install -y flathub org.gnome.Contacts || true
flatpak install -y flathub org.gnome.Epiphany || true
flatpak install -y flathub org.gnome.Loupe || true
flatpak install -y flathub org.gnome.Maps || true
flatpak install -y flathub net.nokyan.Resources || true
flatpak install -y flathub org.gnome.TextEditor || true
flatpak install -y flathub org.gnome.Weather || true
