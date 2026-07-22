FROM quay.io/fedora/fedora-bootc:44

RUN dnf install -y \
    # Drivers
    mesa-dri-drivers \
    mesa-vulkan-drivers \
    \
    # Desktop
    gdm \
    gnome-shell \
    gnome-session-wayland-session \
    \
    # Network and sounds
    pipewire \
    pipewire-pulseaudio \
    wireplumber \
    NetworkManager-wifi \
    bluez \
    \
    # Portals for Flatpak
    xdg-desktop-portal-gnome \
    gnome-control-center \
    \
    # 5. TEMEL İHTİYAÇLAR (Fontlar çok kritik!)
    # Font paketi kurmazsan GNOME'daki tüm yazılar kare (tofu) şeklinde görünür.
    google-noto-sans-fonts \
    ptyxis \
    nautilus \
    && dnf clean all

# Start the system with the GUI.
RUN systemctl enable gdm.service && \
    systemctl set-default graphical.target

# İsteğe bağlı: Kendi kullanıcı ayarlarını veya ekstra scriptlerini buraya kopyalayabilirsin
# COPY config/ /etc/