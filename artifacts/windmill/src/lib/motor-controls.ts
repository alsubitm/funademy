/** Integrate the driving shaft instead of multiplying absolute time by the
 * current speed: changing speed/direction must not teleport the mechanism. */
export function advanceDriverAngle(
  angle: number,
  elapsedSeconds: number,
  rpm: number,
  speed: number,
  direction: 1 | -1,
): number {
  if (![angle, elapsedSeconds, rpm, speed].every(Number.isFinite) ||
    elapsedSeconds < 0 || rpm < 0 || speed < 0 ||
    (direction !== 1 && direction !== -1)) {
    throw new RangeError('Motor parameters must be finite and nonnegative; direction must be 1 or -1.');
  }
  return angle + elapsedSeconds * rpm * 6 * speed * direction;
}

/** Meshed external gears rotate oppositely. The output axle and rotor are
 * rigidly coupled to the driven gear. Pause preserves the supplied angle. */
export function transmissionMotion(
  driverAngle: number,
  driverTeeth: number,
  drivenTeeth: number,
  running: boolean,
) {
  if (!Number.isFinite(driverAngle) || !Number.isSafeInteger(driverTeeth) ||
    !Number.isSafeInteger(drivenTeeth) || driverTeeth <= 0 || drivenTeeth <= 0) {
    throw new RangeError('Gear teeth must be positive integers and angle must be finite.');
  }
  const driven = -driverAngle * driverTeeth / drivenTeeth;
  return { driver: driverAngle, driven, axle: driven, rotor: driven, motorOn: running };
}
