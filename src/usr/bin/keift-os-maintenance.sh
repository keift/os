#!/usr/bin/env bash

execute() {
  for bus_path in /run/user/*/bus; do
    if [ -e "${bus_path}" ]; then
      local uid=$(echo "${bus_path}" | cut -f4 -d "/")
      local username=$(id -n -u "${uid}")

      sudo -u "${username}" \
        DBUS_SESSION_BUS_ADDRESS="unix:path=${bus_path}" \
        DISPLAY=:0 \
        "${@}"
    fi
  done
}

while [ ! -f /home/*/.config/gnome-initial-setup-done ]; do sleep 10; done

while ! curl -sI --max-time 10 https://flathub.org &> /dev/null; do sleep 10; done

sleep 10

cp /usr/etc/dconf/db/distro.d/99-keift-os /etc/dconf/db/distro.d/99-keift-os

state_file="/etc/keift-os-maintenance-sequence"

target_sequence=0

if [ -f "${state_file}" ]; then
  current_sequence=$(cat "${state_file}")
else
  current_sequence=-1
fi

if [ "${current_sequence}" -lt "${target_sequence}" ]; then
  execute notify-send -a "Keift OS" "Installation is in progress..." "The installation may take a few minutes to complete."

  for ((sequence = current_sequence + 1; sequence <= target_sequence; sequence++)); do
    if [ "${sequence}" -eq 0 ]; then
      flatpak remote-delete --force fedora || true
      flatpak remote-delete --force fedora-testing || true

      flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo

      flatpak install -y \
        net.nokyan.Resources \
        org.gnome.Calculator \
        org.gnome.Calendar \
        org.gnome.clocks \
        org.gnome.Contacts \
        org.gnome.Decibels \
        org.gnome.Epiphany \
        org.gnome.Loupe \
        org.gnome.Maps \
        org.gnome.Papers \
        org.gnome.Showtime \
        org.gnome.Snapshot \
        org.gnome.TextEditor \
        org.gnome.Weather

      execute gsettings reset org.gnome.shell app-picker-layout
      execute gsettings reset org.gnome.shell favorite-apps
    fi

    echo "${sequence}" > "${state_file}"
  done

  execute notify-send -a "Keift OS" "Installation complete" "Your Keift OS is ready."
fi
