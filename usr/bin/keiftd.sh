#!/usr/bin/env bash

set -e

flatpak remote-delete fedora
flatpak remote-delete fedora-testing

flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo

gsettings set org.gnome.shell favorite-apps [ \
  "org.gnome.Software.desktop", \
  "org.gnome.Nautilus.desktop", \
  "org.gnome.TextEditor.desktop", \
  "org.gnome.Ptyxis.desktop", \
  "org.gnome.Epiphany.desktop" \
  ]

flatpak install -y flathub net.nokyan.Resources
flatpak install -y flathub org.gnome.Calculator
flatpak install -y flathub org.gnome.Calendar
flatpak install -y flathub org.gnome.clocks
flatpak install -y flathub org.gnome.Contacts
flatpak install -y flathub org.gnome.Epiphany
flatpak install -y flathub org.gnome.Loupe
flatpak install -y flathub org.gnome.Maps
flatpak install -y flathub org.gnome.TextEditor
flatpak install -y flathub org.gnome.Weather
