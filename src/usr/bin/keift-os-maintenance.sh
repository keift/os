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

state_file="/etc/keift-os-maintenance-sequence"

target_sequence=0

if [ -f "${state_file}" ]; then
  current_sequence=$(cat "${state_file}")
else
  current_sequence=-1
fi

if [ "${current_sequence}" -ge "${target_sequence}" ]; then
  exit 0
fi

execute notify-send -a "Keift OS" "Kurulum devam ediyor..." "Kurulumun tamamlanması birkaç dakika sürebilir."

for ((sequence = current_sequence + 1; sequence <= target_sequence; sequence++)); do
  if [ "${sequence}" -eq 0 ]; then
    flatpak remote-delete --force fedora || true
    flatpak remote-delete --force fedora-testing || true

    flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo

    flatpak install -y net.nokyan.Resources
    flatpak install -y org.gnome.Calculator
    flatpak install -y org.gnome.Calendar
    flatpak install -y org.gnome.clocks
    flatpak install -y org.gnome.Contacts
    flatpak install -y org.gnome.Epiphany
    flatpak install -y org.gnome.Loupe
    flatpak install -y org.gnome.Maps
    flatpak install -y org.gnome.Papers
    flatpak install -y org.gnome.Showtime
    flatpak install -y org.gnome.Snapshot
    flatpak install -y org.gnome.TextEditor
    flatpak install -y org.gnome.Weather

    execute gsettings reset org.gnome.shell app-picker-layout
  elif [ "${sequence}" -eq 1 ]; then
    :
  elif [ "${sequence}" -eq 2 ]; then
    :
  fi

  echo "${sequence}" > "${state_file}"
done

execute notify-send -a "Keift OS" "Kurulum tamamlandı" "Keift OS'unuz hazır."
