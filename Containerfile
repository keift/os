FROM quay.io/fedora/fedora-bootc:44

RUN dnf install -y \
  # Desktop
  gnome-shell \
  gnome-session \
  gdm \
  gnome-initial-setup \
  glibc-all-langpacks \
  # QEMU/KVM
  spice-vdagent \
  spice-webdavd \
  # Drivers
  mesa-vulkan-drivers \
  mesa-dri-drivers \
  \
  # Sounds and network
  pipewire \
  pipewire-pulseaudio \
  wireplumber \
  NetworkManager-wifi \
  bluez \
  \
  # Softwares and portals
  flatpak \
  xdg-desktop-portal-gnome \
  \
  # Applications
  gnome-control-center \
  gnome-software \
  nautilus \
  ptyxis

RUN dnf clean all

# RUN rm -rf /usr/etc/yum.repos.d/*.repo

COPY ./usr /usr

RUN flatpak remote-delete --system --force fedora
RUN flatpak remote-delete --system --force fedora-testing

RUN flatpak remote-add --system --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo

RUN flatpak install -y --system flathub org.gnome.Calculator \
  org.gnome.Calendar \
  org.gnome.clocks \
  org.gnome.Contacts \
  org.gnome.Epiphany \
  org.gnome.Loupe \
  org.gnome.Maps \
  net.nokyan.Resources \
  org.gnome.Showtime \
  org.gnome.TextEditor \
  org.gnome.Weather

RUN chmod +x /usr/bin/keift-os-maintenance.sh
RUN glib-compile-schemas /usr/share/glib-2.0/schemas

RUN systemctl enable keift-os-maintenance.service
RUN echo "root:DEGISTIR-BUNU" | chpasswd
