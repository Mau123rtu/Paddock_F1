/** PRNG con semilla (mulberry32); la semilla vive en el GameState para partidas reproducibles. */
export class Rng {
  constructor(public seed: number) {}
  next(): number {
    this.seed = (this.seed + 0x6d2b79f5) | 0;
    let t = Math.imul(this.seed ^ (this.seed >>> 15), 1 | this.seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(min: number, max: number): number { return Math.floor(this.next() * (max - min + 1)) + min; }
  pick<T>(arr: readonly T[]): T { return arr[this.int(0, arr.length - 1)]; }
}
