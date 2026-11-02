/**
 * Camera pose + projection for the sky overlay.
 *
 * Expo's DeviceMotion `rotation` is a Z-X-Y Euler decomposition (alpha, beta, gamma)
 * of the device→world rotation on both platforms. World frames differ:
 *  - iOS uses CoreMotion's xMagneticNorthZVertical: X = magnetic north, Y = west, Z = up.
 *  - Android uses the rotation-vector frame: X = east, Y = north (magnetic), Z = up.
 */

export type Pose = { az: number; alt: number; roll: number };

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

export function wrap360(a: number) {
  return ((a % 360) + 360) % 360;
}

export function angleDiff(a: number, b: number) {
  return ((a - b + 540) % 360) - 180;
}

/** Camera (back lens) direction and screen roll from DeviceMotion rotation (radians). */
export function poseFromRotation(alpha: number, beta: number, gamma: number, platform: string | undefined): Pose {
  const sa = Math.sin(alpha);
  const ca = Math.cos(alpha);
  const sb = Math.sin(beta);
  const cb = Math.cos(beta);
  const sg = Math.sin(gamma);
  const cg = Math.cos(gamma);
  // Camera looks along device −Z: world vector = −(third column of R).
  const vx = -(cg * sa * sb + ca * sg);
  const vy = -(sa * sg - ca * cg * sb);
  const vz = -(cb * cg);
  const az = platform === 'ios' ? Math.atan2(-vy, vx) * R2D : Math.atan2(vx, vy) * R2D;
  const alt = Math.asin(Math.max(-1, Math.min(1, vz))) * R2D;
  // World "up" expressed in device coordinates is the third row of R.
  const ux = -cb * sg;
  const uy = sb;
  const roll = Math.atan2(ux, uy) * R2D;
  return { az: wrap360(az), alt, roll };
}

export type Projector = (az: number, alt: number) => { x: number; y: number; z: number };

/**
 * Projects an [east, north, up] unit vector. Returns screen x/y and camera depth z;
 * x/y are NaN behind the camera. Hot path for the planetarium, so it allocates nothing
 * when given an output object.
 */
export type VecProjector = (e: number, n: number, u: number, out?: { x: number; y: number; z: number }) => { x: number; y: number; z: number };

export function makeVecProjector(pose: Pose, width: number, height: number, vfov: number): VecProjector & { focal: number } {
  const a = pose.az * D2R;
  const el = pose.alt * D2R;
  const sa = Math.sin(a);
  const ca = Math.cos(a);
  const se = Math.sin(el);
  const ce = Math.cos(el);
  // ENU basis for the camera.
  const f0 = sa * ce, f1 = ca * ce, f2 = se;
  const r0 = ca, r1 = -sa;
  const u0 = -se * sa, u1 = -se * ca, u2 = ce;
  const focal = height / 2 / Math.tan((vfov * D2R) / 2);
  const rho = pose.roll * D2R;
  const cr = Math.cos(rho);
  const sr = Math.sin(rho);
  const cx = width / 2;
  const cy = height / 2;
  const fn = (e: number, n: number, u: number, out = { x: 0, y: 0, z: 0 }) => {
    const x = e * r0 + n * r1;
    const y = e * u0 + n * u1 + u * u2;
    const z = e * f0 + n * f1 + u * f2;
    out.z = z;
    if (z <= 0.02) {
      out.x = NaN;
      out.y = NaN;
      return out;
    }
    const sx = (x / z) * focal;
    const sy = -(y / z) * focal;
    out.x = cx + sx * cr - sy * sr;
    out.y = cy + sx * sr + sy * cr;
    return out;
  };
  return Object.assign(fn, { focal });
}

/** Inverse of makeVecProjector: the [east, north, up] direction under a screen point. */
export function makeUnprojector(pose: Pose, width: number, height: number, vfov: number) {
  const a = pose.az * D2R;
  const el = pose.alt * D2R;
  const sa = Math.sin(a);
  const ca = Math.cos(a);
  const se = Math.sin(el);
  const ce = Math.cos(el);
  const f = [sa * ce, ca * ce, se];
  const r = [ca, -sa, 0];
  const u = [-se * sa, -se * ca, ce];
  const focal = height / 2 / Math.tan((vfov * D2R) / 2);
  const rho = pose.roll * D2R;
  const cr = Math.cos(rho);
  const sr = Math.sin(rho);
  return (x: number, y: number): [number, number, number] => {
    const dx = x - width / 2;
    const dy = y - height / 2;
    const sx = (dx * cr + dy * sr) / focal;
    const sy = (-dx * sr + dy * cr) / focal;
    const v = [f[0] + sx * r[0] - sy * u[0], f[1] + sx * r[1] - sy * u[1], f[2] + sx * r[2] - sy * u[2]];
    const l = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / l, v[1] / l, v[2] / l];
  };
}

/** Pinhole projection centred on the screen. `vfov` is the vertical field of view. */
export function makeProjector(pose: Pose, width: number, height: number, vfov: number): Projector {
  const project = makeVecProjector(pose, width, height, vfov);
  return (paz: number, palt: number) => {
    const pa = paz * D2R;
    const pe = palt * D2R;
    return project(Math.sin(pa) * Math.cos(pe), Math.cos(pa) * Math.cos(pe), Math.sin(pe));
  };
}

/** Builds polyline segments, breaking where points leave the front hemisphere or jump. */
export function polylines(points: { az: number; alt: number }[], project: Projector, width: number, height: number): string[] {
  const out: string[] = [];
  let cur = '';
  let last: { x: number; y: number } | null = null;
  const maxJump = Math.max(width, height) * 1.5;
  for (const p of points) {
    const s = project(p.az, p.alt);
    const ok = Number.isFinite(s.x) && Math.abs(s.x - width / 2) < width * 3 && Math.abs(s.y - height / 2) < height * 3;
    if (!ok || (last && Math.hypot(s.x - last.x, s.y - last.y) > maxJump)) {
      if (cur) out.push(cur);
      cur = '';
      last = null;
      if (!ok) continue;
    }
    cur += `${cur ? 'L' : 'M'}${s.x.toFixed(1)},${s.y.toFixed(1)}`;
    last = s;
  }
  if (cur) out.push(cur);
  return out;
}

/** Where to put an edge arrow for an off-screen target, and its rotation in degrees. */
export function edgeIndicator(pose: Pose, targetAz: number, targetAlt: number, width: number, height: number, margin = 56) {
  const dAz = angleDiff(targetAz, pose.az);
  const dAlt = targetAlt - pose.alt;
  // Screen-space direction, accounting for roll.
  const rho = pose.roll * D2R;
  const dx = dAz;
  const dy = -dAlt;
  const sx = dx * Math.cos(rho) - dy * Math.sin(rho);
  const sy = dx * Math.sin(rho) + dy * Math.cos(rho);
  const ang = Math.atan2(sy, sx);
  const hw = width / 2 - margin;
  const hh = height / 2 - margin * 2;
  const t = Math.min(Math.abs(hw / Math.cos(ang)), Math.abs(hh / Math.sin(ang)));
  return { x: width / 2 + Math.cos(ang) * t, y: height / 2 + Math.sin(ang) * t, rotation: ang * R2D + 90, distance: Math.hypot(dAz, dAlt) };
}

/** Circular low-pass for angles (degrees). */
export function smoothAngle(prev: number, next: number, k: number) {
  return wrap360(prev + angleDiff(next, prev) * k);
}
