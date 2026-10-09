/** A line between two buses; `x` is its reactance in per unit. */
export interface DcBranch {
  from: number;
  to: number;
  x: number;
  inService: boolean;
}

export interface DcFlowInput {
  busCount: number;
  branches: readonly DcBranch[];
  /** Net injection per bus in per unit: generation minus load. */
  injections: ArrayLike<number>;
  /** Preference for the slack bus of each island (e.g. generation capacity); highest wins. */
  slackWeight: ArrayLike<number>;
}

export interface DcFlowResult {
  /** Bus voltage angle in radians; 0 at each island's slack. */
  theta: Float64Array;
  /** Flow per branch in per unit, from → to; 0 for branches out of service. */
  flows: Float64Array;
  /** Island id per bus (0, 1, …), after out-of-service branches are removed. */
  island: Int32Array;
  islandCount: number;
  /** Buses in islands with no generation (slack weight 0 everywhere): no power, no flows. */
  deEnergized: Uint8Array;
  /** Per island: what its slack bus picks up on top of its own injection, in per unit. */
  slackInjection: Float64Array;
}

/** Union–find over buses, joined by in-service branches. */
const findIslands = (busCount: number, branches: readonly DcBranch[]) => {
  const parent = Int32Array.from({ length: busCount }, (_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  branches.forEach(({ from, to, inService }) => {
    if (inService) parent[find(from)] = find(to);
  });
  const island = new Int32Array(busCount);
  const ids = new Map<number, number>();
  for (let bus = 0; bus < busCount; bus += 1) {
    const root = find(bus);
    if (!ids.has(root)) ids.set(root, ids.size);
    island[bus] = ids.get(root)!;
  }
  return { island, islandCount: ids.size };
};

/**
 * Solves A·x = b in place (dense, Gaussian elimination with partial pivoting). `a` is row-major
 * n×n. Returns x, or null if the matrix is singular.
 */
export const solveDense = (a: Float64Array, b: Float64Array, n: number): Float64Array | null => {
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(a[row * n + col]) > Math.abs(a[pivot * n + col])) pivot = row;
    }
    if (Math.abs(a[pivot * n + col]) < 1e-12) return null;
    if (pivot !== col) {
      for (let k = 0; k < n; k += 1) {
        const tmp = a[col * n + k];
        a[col * n + k] = a[pivot * n + k];
        a[pivot * n + k] = tmp;
      }
      const tmp = b[col];
      b[col] = b[pivot];
      b[pivot] = tmp;
    }
    const diagonal = a[col * n + col];
    for (let row = col + 1; row < n; row += 1) {
      const factor = a[row * n + col] / diagonal;
      if (factor === 0) continue;
      for (let k = col; k < n; k += 1) a[row * n + k] -= factor * a[col * n + k];
      b[row] -= factor * b[col];
    }
  }
  const x = new Float64Array(n);
  for (let row = n - 1; row >= 0; row -= 1) {
    let sum = b[row];
    for (let k = row + 1; k < n; k += 1) sum -= a[row * n + k] * x[k];
    x[row] = sum / a[row * n + row];
  }
  return x;
};

/**
 * DC power flow: P = B'·θ on each island, with the island's slack bus at θ = 0 absorbing the
 * imbalance, then flow = (θ_from − θ_to) / x. Islands without generation are de-energised.
 */
export const solveDcFlow = ({
  busCount,
  branches,
  injections,
  slackWeight,
}: DcFlowInput): DcFlowResult => {
  const { island, islandCount } = findIslands(busCount, branches);
  const theta = new Float64Array(busCount);
  const flows = new Float64Array(branches.length);
  const deEnergized = new Uint8Array(busCount);
  const slackInjection = new Float64Array(islandCount);

  const busesOf: number[][] = Array.from({ length: islandCount }, () => []);
  for (let bus = 0; bus < busCount; bus += 1) busesOf[island[bus]].push(bus);

  busesOf.forEach((buses, id) => {
    const slack = buses.reduce((best, bus) => (slackWeight[bus] > slackWeight[best] ? bus : best));
    if (!(slackWeight[slack] > 0)) {
      buses.forEach((bus) => (deEnergized[bus] = 1));
      return;
    }
    // Everyone except the slack, numbered 0..n-1 within the island.
    const position = new Map<number, number>();
    buses.forEach((bus) => bus !== slack && position.set(bus, position.size));
    const n = position.size;
    let imbalance = 0;
    buses.forEach((bus) => (imbalance += injections[bus]));
    // The slack ends up injecting its own value plus this, so the island balances.
    slackInjection[id] = -imbalance;
    if (n === 0) return;

    const matrix = new Float64Array(n * n);
    const rhs = new Float64Array(n);
    position.forEach((p, bus) => (rhs[p] = injections[bus]));
    branches.forEach(({ from, to, x, inService }) => {
      if (!inService || island[from] !== id) return;
      const b = 1 / x;
      const pf = position.get(from);
      const pt = position.get(to);
      if (pf !== undefined) matrix[pf * n + pf] += b;
      if (pt !== undefined) matrix[pt * n + pt] += b;
      if (pf !== undefined && pt !== undefined) {
        matrix[pf * n + pt] -= b;
        matrix[pt * n + pf] -= b;
      }
    });
    const angles = solveDense(matrix, rhs, n);
    if (!angles) return;
    position.forEach((p, bus) => (theta[bus] = angles[p]));
  });

  branches.forEach(({ from, to, x, inService }, i) => {
    flows[i] = inService && !deEnergized[from] ? (theta[from] - theta[to]) / x : 0;
  });
  return { theta, flows, island, islandCount, deEnergized, slackInjection };
};
