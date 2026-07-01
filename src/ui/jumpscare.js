// Fullscreen killer face, pixel-crunched and shaking, for ~1.2 seconds.
// faceCanvas is the killer's 8x8 headFront skin region.
export function playJumpscare(canvas, faceCanvas, onDone) {
  if (!faceCanvas) { onDone(); return; }
  canvas.classList.remove('hidden');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const start = performance.now();

  function frame() {
    const t = (performance.now() - start) / 1000;
    if (t > 1.2) {
      canvas.classList.add('hidden');
      onDone();
      return;
    }
    requestAnimationFrame(frame);
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = Math.random() < 0.15 ? '#300' : '#000';
    ctx.fillRect(0, 0, w, h);
    const scale = (h * (1.05 + t * 0.35)) / faceCanvas.height;
    const fw = faceCanvas.width * scale, fh = faceCanvas.height * scale;
    const shake = 18 + t * 30;
    const ox = (w - fw) / 2 + (Math.random() - 0.5) * shake;
    const oy = (h - fh) / 2 + (Math.random() - 0.5) * shake;
    ctx.drawImage(faceCanvas, ox, oy, fw, fh);
  }
  frame();
}
