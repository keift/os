FROM quay.io/fedora/fedora-bootc:44

RUN dnf install -y \
  # Desktop
  gnome-shell \
  gnome-session-wayland-session \
  gdm \
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
  # Softwares
  flatpak \
  gnome-software \
  xdg-desktop-portal-gnome \
  \
  # Others
  gnome-control-center \
  nautilus \
  ptyxis

RUN dnf clean all

RUN rm -rf /usr/etc/yum.repos.d/*.repo

COPY ./usr /usr

RUN chmod +x /usr/bin/keiftd.sh

RUN systemctl enable gdm.service \
  && systemctl set-default graphical.target \
  && systemctl enable keiftd.service
