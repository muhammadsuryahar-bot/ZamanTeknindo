/*
 * Camera startup compatibility guard.
 * Only normalizes camera constraints. React remains responsible for button
 * state and server-side attendance verification.
 */
(() => {
  const setup = () => {
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.getUserMedia) return;

    const originalGetUserMedia = mediaDevices.getUserMedia.bind(mediaDevices);

    mediaDevices.getUserMedia = (constraints) => {
      if (!constraints?.video || constraints.video === true) {
        return originalGetUserMedia(constraints);
      }

      const video = constraints.video;
      const safeConstraints = {
        ...constraints,
        video: {
          facingMode: video.facingMode ?? { ideal: "user" },
        },
      };

      return originalGetUserMedia(safeConstraints).catch((error) => {
        if (
          error?.name === "NotAllowedError" ||
          error?.name === "SecurityError"
        ) {
          throw error;
        }

        return originalGetUserMedia({
          ...constraints,
          video: true,
          audio: false,
        });
      });
    };
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup, { once: true });
  } else {
    setup();
  }
})();
