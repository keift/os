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
  # Network and sounds
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
  ptyxis \
  google-noto-sans-fonts

RUN dnf clean all

RUN rm -rf /usr/etc/yum.repos.d/*.repo

RUN flatpak remote-delete --user fedora
RUN flatpak remote-delete --user fedora-testing

COPY ./usr /usr

RUN systemctl enable gdm.service \
  && systemctl set-default graphical.target \
  && systemctl enable keift-os.service
