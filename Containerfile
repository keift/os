FROM quay.io/fedora/fedora-bootc:44

RUN dnf install -y \
  # Desktop
  gnome-shell \
  gnome-session \
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
  # Softwares and portals
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

RUN chmod +x /usr/bin/keift-os-maintenance.sh

RUN cat <<EOF > /usr/share/glib-2.0/schemas/99-keift-os.gschema.override
[org.gnome.desktop.interface]
accent-color="blue"

[org.gnome.desktop.background]
picture-uri="/usr/share/backgrounds/anders-jilden-cYrMQA7a3Wc-unsplash.jpg"
picture-uri-dark="/usr/share/backgrounds/anders-jilden-cYrMQA7a3Wc-unsplash.jpg"

[org.gnome.shell]
favorite-apps=["org.gnome.Software.desktop", "org.gnome.Nautilus.desktop", "org.gnome.TextEditor.desktop", "org.gnome.Ptyxis.desktop", "org.gnome.Epiphany.desktop"]
EOF

RUN glib-compile-schemas /usr/share/glib-2.0/schemas

RUN systemctl enable gdm.service \
  && systemctl set-default graphical.target \
  && systemctl enable keift-os-maintenance.service
