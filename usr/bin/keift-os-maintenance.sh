#!/usr/bin/env bash

exit

while ! ping -c 1 1.1.1.1 &> /dev/null; do sleep 1; done

notify-send -a "Keift OS" "Kurulum devam ediyor..." "Kurulumun tamamlanması birkaç dakika sürebilir."

flatpak remote-delete --force fedora || true
flatpak remote-delete --force fedora-testing || true

flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo || true

flatpak install -y flathub org.gnome.Calculator || true
flatpak install -y flathub org.gnome.Calendar || true
flatpak install -y flathub org.gnome.clocks || true
flatpak install -y flathub org.gnome.Contacts || true
flatpak install -y flathub org.gnome.Epiphany || true
flatpak install -y flathub org.gnome.Loupe || true
flatpak install -y flathub org.gnome.Maps || true
flatpak install -y flathub net.nokyan.Resources || true
flatpak install -y flathub org.gnome.Showtime || true
flatpak install -y flathub org.gnome.TextEditor || true
flatpak install -y flathub org.gnome.Weather || true

notify-send -a "Keift OS" "Kurulum tamamlandı" "Keift OS'unuz hazır."
