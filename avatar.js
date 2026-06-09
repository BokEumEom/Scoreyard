// avatar.js — player avatar helpers. Both functions are self-contained: they
// create their own offscreen canvas and never touch game/render state.

// Deterministic initials avatar (gradient tile + up-to-two initials).
export function makeAvatarDataUrl(name) {
  const avatarCanvas = document.createElement("canvas");
  const avatarCtx = avatarCanvas.getContext("2d");
  const initials = (name || "GP")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0].toUpperCase())
    .join("") || "GP";

  avatarCanvas.width = 160;
  avatarCanvas.height = 160;

  const gradient = avatarCtx.createLinearGradient(0, 0, 160, 160);
  gradient.addColorStop(0, "#c7f4df");
  gradient.addColorStop(1, "#147d73");

  avatarCtx.fillStyle = gradient;
  avatarCtx.fillRect(0, 0, 160, 160);
  avatarCtx.fillStyle = "#ffffff";
  avatarCtx.font = "700 58px system-ui, sans-serif";
  avatarCtx.textAlign = "center";
  avatarCtx.textBaseline = "middle";
  avatarCtx.fillText(initials, 80, 84);

  return avatarCanvas.toDataURL("image/png");
}

// Validate, downscale, and re-encode an uploaded image to a 256px JPEG data URL.
export function compressAvatar(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Please choose an image file."));
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      reject(new Error("Please choose an image under 4 MB."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Unable to read that image."));
      img.onload = () => {
        const avatarCanvas = document.createElement("canvas");
        const avatarCtx = avatarCanvas.getContext("2d");
        const size = 256;
        const scale = Math.max(size / img.width, size / img.height);
        const width = img.width * scale;
        const height = img.height * scale;
        const x = (size - width) / 2;
        const y = (size - height) / 2;

        avatarCanvas.width = size;
        avatarCanvas.height = size;
        avatarCtx.fillStyle = "#f7fbf8";
        avatarCtx.fillRect(0, 0, size, size);
        avatarCtx.drawImage(img, x, y, width, height);
        resolve(avatarCanvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
