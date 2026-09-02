/*
 * Camera startup compatibility guard.
 * Keeps the camera button available while server status verification runs,
 * because verification is still enforced by the React submit handler.
 */
(() => {
  const setup = () => {
    const mediaDevices = navigator.mediaDevices;
    if (mediaDevices?.getUserMedia) {
      const originalGetUserMedia = mediaDevices.getUserMedia.bind(mediaDevices);

      mediaDevices.getUserMedia = (constraints) => {
        if (!constraints || !constraints.video || constraints.video === true) {
          return originalGetUserMedia(constraints);
        }

        // Prefer the camera-facing hint, but avoid forcing resolution values
        // that can make some mobile browsers reject or delay the request.
        const video = constraints.video;
        const safeVideo = {
          facingMode: video.facingMode ?? { ideal: "user" },
        };

        return originalGetUserMedia({
          ...constraints,
          video: safeVideo,
        }).catch((error) => {
          if (
            error?.name === "NotAllowedError" ||
            error?.name === "SecurityError"
          ) {
            throw error;
          }

          return originalGetUserMedia({
            ...constraints,
            video: true,
          });
        });
      };
    }

    const bukaKameraBolehJalan = (button) => {
      if (!button || button.disabled) {
        button.disabled = false;
      }
    };

    const scan = () => {
      const buttons = document.querySelectorAll("button");
      for (const button of buttons) {
        const text = (button.textContent || "").trim();
        if (
          text === "Memverifikasi Status..." ||
          text === "Buka Kamera"
        ) {
          bukaKameraBolehJalan(button);
        }
      }
    };

    scan();

    const observer = new MutationObserver(() => scan());
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["disabled"],
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup, { once: true });
  } else {
    setup();
  }
})();
