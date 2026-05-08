{pkgs}: {
  deps = [
    pkgs.gcc-unwrapped
    pkgs.libgcc
    pkgs.ffmpeg
  ];
}
