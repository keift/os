#!/usr/bin/env bash

execute() {
  for bus_path in /run/user/*/bus; do
    if [ -e "${bus_path}" ]; then
      local uid=$(echo "${bus_path}" | cut -f4 -d "/")
      local username=$(id -nu "${uid}")

      sudo -u "${username}" \
        DBUS_SESSION_BUS_ADDRESS="unix:path=${bus_path}" \
        DISPLAY=:0 \
        "${@}"
    fi
  done
}

while ! ping -c 1 1.1.1.1 &> /dev/null; do sleep 1; done

execute notify-send -a "Keift OS" "Kurulum devam ediyor..." "Kurulumun tamamlanması birkaç dakika sürebilir."

flatpak remote-delete --force fedora || true
flatpak remote-delete --force fedora-testing || true

flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo

flatpak install -y \
  net.nokyan.Resources \
  org.gnome.Calculator \
  org.gnome.Calendar \
  org.gnome.clocks \
  org.gnome.Contacts \
  org.gnome.Epiphany \
  org.gnome.Loupe \
  org.gnome.Maps \
  org.gnome.Showtime \
  org.gnome.TextEditor \
  org.gnome.Weather

execute dconf reset -f /

execute notify-send -a "Keift OS" "Kurulum tamamlandı" "Keift OS'unuz hazır."
