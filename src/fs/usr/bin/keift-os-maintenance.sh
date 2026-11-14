#!/usr/bin/env bash

execute() {
  for bus_path in /run/user/*/bus; do
    if [ -e "${bus_path}" ]; then
      local uid=$(echo "${bus_path}" | cut -f 4 -d "/")

      if [ "${uid}" -ge 1000 ]; then
        local username=$(id -n -u "${uid}")

        sudo -u "${username}" DBUS_SESSION_BUS_ADDRESS="unix:path=${bus_path}" "${@}"
      fi
    fi
  done
}

while [ ! -f /home/*/.config/gnome-initial-setup-done ]; do sleep 10; done

while ! curl -fsSL --max-time 10 https://flathub.org &> /dev/null; do sleep 10; done

sleep 10

cp -f /usr/etc/dconf/db/distro.d/99-keift-os /etc/dconf/db/distro.d/99-keift-os &> /dev/null

systemctl preset fstrim &> /dev/null
systemctl preset fstrim.timer &> /dev/null

target_sequence=0
current_sequence=$(cat /etc/keift-os-maintenance-sequence 2> /dev/null || echo "-1")

if [ "${current_sequence}" -lt "${target_sequence}" ]; then
  execute notify-send -a "Keift OS" "Installation is in progress..." "The installation may take a few minutes to complete." &> /dev/null

  success=true

  for ((sequence = current_sequence + 1; sequence <= target_sequence; sequence++)); do
    if [ "${sequence}" -eq 0 ]; then
      flatpak remote-delete --force fedora &> /dev/null
      flatpak remote-delete --force fedora-testing &> /dev/null

      flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo &> /dev/null || success=false

      flatpak install -y net.nokyan.Resources &> /dev/null || success=false # Resources
      flatpak install -y org.gnome.Calculator &> /dev/null || success=false # Calculator
      flatpak install -y org.gnome.Calendar &> /dev/null || success=false   # Calendar
      flatpak install -y org.gnome.clocks &> /dev/null || success=false     # Clocks
      flatpak install -y org.gnome.Contacts &> /dev/null || success=false   # Contacts
      flatpak install -y org.gnome.Decibels &> /dev/null || success=false   # Audio Player
      flatpak install -y org.gnome.Epiphany &> /dev/null || success=false   # Web
      flatpak install -y org.gnome.Loupe &> /dev/null || success=false      # Image Viewer
      flatpak install -y org.gnome.Maps &> /dev/null || success=false       # Maps
      flatpak install -y org.gnome.Papers &> /dev/null || success=false     # Document Viewer
      flatpak install -y org.gnome.Showtime &> /dev/null || success=false   # Video Player
      flatpak install -y org.gnome.Snapshot &> /dev/null || success=false   # Camera
      flatpak install -y org.gnome.TextEditor &> /dev/null || success=false # Text Editor
      flatpak install -y org.gnome.Weather &> /dev/null || success=false    # Weather

      execute gsettings reset org.gnome.shell app-picker-layout &> /dev/null
      execute gsettings reset org.gnome.shell favorite-apps &> /dev/null
    fi

    [ "${success}" = false ] && break

    echo "${sequence}" > /etc/keift-os-maintenance-sequence 2> /dev/null
  done

  [ "${success}" = true ] && execute notify-send -a "Keift OS" "Installation complete" "Your Keift OS is ready." &> /dev/null
fi
