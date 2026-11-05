/* =========================================================
   Built For Life — demo "after" preview
   DEMO ONLY: warps the photo (slimmer waist and torso, a little more
   definition) in proportion to the weight they want to lose.
   LIVE: when the AI "future you" photo exists (img.__after), draw() blends
   from the real photo into the AI one instead of warping.
   ========================================================= */
(function () {
  const g = (y, c, s) => Math.exp(-((y - c) * (y - c)) / (2 * s * s));

  /* strength 0..1 from how much weight they want to lose (capped, so it stays believable) */
  function strength(weight, target) {
    // gaining: a negative strength means build up the shoulders, chest and arms
    if (target > weight) return -Math.min(0.12, 0.04 + ((target - weight) / Math.max(weight, 1)) * 1.1);
    const pct = Math.max(0, (weight - target) / Math.max(weight, 1));
    return Math.min(0.17, 0.035 + pct * 1.25);
  }

  /* draw the photo into ctx (w×h) at progress t (0 = before, 1 = target) */
  function cover(ctx, im, w, h) {
    const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height, sc = Math.max(w / iw, h / ih), sw = w / sc, sh = h / sc;
    ctx.drawImage(im, (iw - sw) / 2, (ih - sh) / 2, sw, sh, 0, 0, w, h);
  }
  function draw(ctx, img, w, h, t, k) {
    // live site: a real AI "after" photo is attached as img.__after, so blend into it
    if (img.__after) {
      const a = img.__after, tt = Math.max(0, Math.min(1, t));
      if (tt < 1) { const keep = img.__after; img.__after = null; draw(ctx, img, w, h, tt * 0.6, k); img.__after = keep; }
      if (tt > 0) { ctx.save(); ctx.globalAlpha = tt < 1 ? Math.min(1, tt * 1.15) : 1; cover(ctx, a, w, h); ctx.restore(); }
      return;
    }
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    // cover-fit the photo into the canvas
    const sc = Math.max(w / iw, h / ih), sw = w / sc, sh = h / sc, sx0 = (iw - sw) / 2, sy0 = (ih - sh) / 2;
    ctx.save();
    ctx.filter = t > 0.001 ? `contrast(${1 + 0.1 * t}) saturate(${1 + 0.12 * t}) brightness(${1 + 0.03 * t})` : "none";
    if (t <= 0.001 || !k) { ctx.drawImage(img, sx0, sy0, sw, sh, 0, 0, w, h); ctx.restore(); return; }
    const step = 2, cx = w / 2, half = w * 0.3; // body assumed centred, spanning ~60% of width
    for (let y = 0; y < h; y += step) {
      const yn = y / h;
      // most change at the waist/belly, some at chest and hips, a touch in arms/thighs
      const band = k < 0
        ? Math.min(1, g(yn, 0.3, 0.07) + 0.7 * g(yn, 0.4, 0.07) + 0.35 * g(yn, 0.2, 0.04) + 0.25 * g(yn, 0.72, 0.08)) // shoulders, chest, arms, a little leg
        : Math.min(1, g(yn, 0.53, 0.13) + 0.55 * g(yn, 0.38, 0.08) + 0.45 * g(yn, 0.68, 0.1));
      const s = 1 - t * k * band;
      const srcY = sy0 + (y / h) * sh, srcH = (step / h) * sh;
      const inner = half * s;
      // left background strip (stretched), body (narrowed), right background strip (stretched)
      const sL = sx0, sC = sx0 + (cx - half) / sc, sR = sx0 + (cx + half) / sc, sE = sx0 + sw;
      ctx.drawImage(img, sL, srcY, sC - sL, srcH, 0, y, cx - inner, step + 0.5);
      ctx.drawImage(img, sC, srcY, sR - sC, srcH, cx - inner, y, inner * 2, step + 0.5);
      ctx.drawImage(img, sR, srcY, sE - sR, srcH, cx + inner, y, w - (cx + inner), step + 0.5);
    }
    ctx.restore();
    // a soft vignette as the "after" settles, so it reads as a finished result
    if (t > 0.05) {
      const v = ctx.createRadialGradient(w / 2, h * 0.45, h * 0.25, w / 2, h * 0.5, h * 0.75);
      v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, `rgba(0,0,0,${0.35 * t})`);
      ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
    }
  }

  function loadImage(src) {
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  }

  /* compress an uploaded file to a JPEG data URL (max side px) */
  function compress(file, max = 720) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onerror = rej;
      r.onload = () => loadImage(r.result).then(img => {
        const s = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement("canvas");
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL("image/jpeg", 0.82));
      }).catch(rej);
      r.readAsDataURL(file);
    });
  }

  /* load a lead's photo with its AI "after" attached when there is one */
  async function loadPair(photo, after) {
    const img = await loadImage(photo);
    if (after) { try { img.__after = await loadImage(after); } catch (e) {} }
    return img;
  }
  window.BFLMorph = { draw, loadPair, strength, loadImage, compress };
})();
