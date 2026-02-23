/**
 * math-utils.js
 * Quaternion ↔ Euler angle helpers used by route-processor and inspector.
 */

const MathUtils = {
  toAngle: (q) => {
    if (!q) return 0;
    return (2 * Math.atan2(q.z, q.w)) * (180 / Math.PI);
  },
  toQuaternion: (deg) => {
    const rad = deg * (Math.PI / 180);
    return { x: 0, y: 0, z: Math.sin(rad / 2), w: Math.cos(rad / 2) };
  }
};
