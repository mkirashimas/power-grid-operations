import { describe, expect, it } from 'vitest';
import { solveDcFlow, solveDense, type DcBranch } from './dcFlow';

const line = (from: number, to: number, x: number, inService = true): DcBranch => ({
  from,
  to,
  x,
  inService,
});

describe('solveDense', () => {
  it('solves a small system and reports a singular one', () => {
    const x = solveDense(Float64Array.from([2, 1, 1, 3]), Float64Array.from([3, 5]), 2)!;
    expect(x[0]).toBeCloseTo(0.8, 12);
    expect(x[1]).toBeCloseTo(1.4, 12);
    expect(solveDense(Float64Array.from([1, 2, 2, 4]), Float64Array.from([1, 2]), 2)).toBeNull();
  });
});

describe('solveDcFlow', () => {
  // Three buses in a triangle with equal reactances: bus 0 generates 1.5 pu, bus 1 takes
  // 1 pu, bus 2 takes 0.5 pu. With equal x the direct path carries 2/3 of a transfer and the
  // two-hop path 1/3.
  const triangle = [line(0, 1, 0.1), line(1, 2, 0.1), line(0, 2, 0.1)];
  const injections = [1.5, -1, -0.5];
  const slackWeight = [1, 0, 0];

  it('matches the hand-solved three-bus case', () => {
    const result = solveDcFlow({ busCount: 3, branches: triangle, injections, slackWeight });
    // Without the slack: [[20, −10], [−10, 20]]·[θ1, θ2] = [−1, −0.5], so θ1 = −1/12, θ2 = −1/15.
    expect(result.theta[0]).toBe(0);
    expect(result.theta[1]).toBeCloseTo(-1 / 12, 9);
    expect(result.theta[2]).toBeCloseTo(-1 / 15, 9);
    expect(result.flows[0]).toBeCloseTo(5 / 6, 9); // 0 → 1
    expect(result.flows[1]).toBeCloseTo(-1 / 6, 9); // 1 → 2 (so 2 → 1 carries 1/6)
    expect(result.flows[2]).toBeCloseTo(2 / 3, 9); // 0 → 2
    expect(result.islandCount).toBe(1);
  });

  it('balances power at every bus', () => {
    const { flows } = solveDcFlow({ busCount: 3, branches: triangle, injections, slackWeight });
    const net = [0, 0, 0];
    triangle.forEach(({ from, to }, i) => {
      net[from] -= flows[i];
      net[to] += flows[i];
    });
    // What leaves through lines equals what is injected.
    injections.forEach((p, bus) => expect(-net[bus]).toBeCloseTo(p, 9));
  });

  it('moves the flow of a tripped line onto the remaining path', () => {
    const tripped = triangle.map((branch, i) =>
      i === 0 ? { ...branch, inService: false } : branch,
    );
    const { flows } = solveDcFlow({ busCount: 3, branches: tripped, injections, slackWeight });
    expect(flows[0]).toBe(0);
    // Everything now goes 0 → 2 → 1.
    expect(flows[2]).toBeCloseTo(1.5, 9);
    expect(flows[1]).toBeCloseTo(-1, 9);
  });

  it('splits islands, solving each with its own slack and de-energising those without one', () => {
    // 0–1 (generation at 0) and 2–3 (no generation), joined only by a tripped line.
    const branches = [line(0, 1, 0.1), line(2, 3, 0.1), line(1, 2, 0.1, false)];
    const result = solveDcFlow({
      busCount: 4,
      branches,
      injections: [1, -1, 0.2, -0.5],
      slackWeight: [1, 0, 0, 0],
    });
    expect(result.islandCount).toBe(2);
    expect(result.island[0]).toBe(result.island[1]);
    expect(result.island[2]).not.toBe(result.island[0]);
    expect(Array.from(result.deEnergized)).toEqual([0, 0, 1, 1]);
    expect(result.flows[0]).toBeCloseTo(1, 9);
    expect(result.flows[1]).toBe(0);
  });

  it('lets the slack pick up an imbalance', () => {
    // Generation short by 0.3 pu: the slack covers it.
    const result = solveDcFlow({
      busCount: 2,
      branches: [line(0, 1, 0.2)],
      injections: [0.7, -1],
      slackWeight: [1, 0],
    });
    expect(result.slackInjection[0]).toBeCloseTo(0.3, 12);
    expect(result.flows[0]).toBeCloseTo(1, 9);
  });
});
