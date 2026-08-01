#!/usr/bin/env bash

send_notification() {
  local name="${1}"
  local title="${2}"
  local content="${3}"

  for bus_path in /run/user/*/bus; do
    if [ -e "${bus_path}" ]; then
      uid=$(echo "${bus_path}" | cut -f4 -d "/")
      username=$(id -nu "${uid}")

      sudo -u "${username}" \
        DBUS_SESSION_BUS_ADDRESS="unix:path=${bus_path}" \
        DISPLAY=:0 \
        /usr/bin/notify-send -a "${name}" "${title}" "${content}"
    fi
  done
}

while ! ping -c 1 1.1.1.1 &> /dev/null; do sleep 1; done

send_notification "Keift OS" "Kurulum devam ediyor..." "Kurulumun tamamlanması birkaç dakika sürebilir."

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

send_notification "Keift OS" "Kurulum tamamlandı" "Keift OS'unuz hazır."
