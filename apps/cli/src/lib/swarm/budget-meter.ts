// budget-meter.ts — per-agent and aggregate turn/USD accounting for a swarm
// run. Pure data; no side effects. The TUI reads the accumulated totals on
// every render; the spawner feeds in deltas as it parses stream-json events
// from each pty.

export interface AgentBudget {
  id: string;
  turnsUsed: number;
  usdSpent: number;
  maxTurns: number;
  maxBudgetUsd: number;
  overBudget: boolean;
}

export interface SwarmBudgetSnapshot {
  totalTurns: number;
  totalUsd: number;
  anyOverBudget: boolean;
  agents: readonly AgentBudget[];
}

export class BudgetMeter {
  private agents = new Map<string, AgentBudget>();

  register(id: string, maxTurns: number, maxBudgetUsd: number): void {
    if (this.agents.has(id)) {
      throw new Error(`budget-meter: duplicate agent id "${id}"`);
    }
    if (maxTurns <= 0 || maxBudgetUsd <= 0) {
      throw new Error(
        `budget-meter: maxTurns and maxBudgetUsd must be positive (got ${maxTurns}, ${maxBudgetUsd})`
      );
    }
    this.agents.set(id, {
      id,
      turnsUsed: 0,
      usdSpent: 0,
      maxTurns,
      maxBudgetUsd,
      overBudget: false,
    });
  }

  recordTurn(id: string, usdDelta: number): AgentBudget {
    const a = this.agents.get(id);
    if (!a) throw new Error(`budget-meter: unknown agent "${id}"`);
    if (usdDelta < 0) {
      throw new Error(
        `budget-meter: usdDelta must be non-negative (got ${usdDelta})`
      );
    }
    a.turnsUsed += 1;
    a.usdSpent = Math.round((a.usdSpent + usdDelta) * 1e6) / 1e6;
    a.overBudget = a.turnsUsed >= a.maxTurns || a.usdSpent >= a.maxBudgetUsd;
    return a;
  }

  isOverBudget(id: string): boolean {
    return this.agents.get(id)?.overBudget === true;
  }

  snapshot(): SwarmBudgetSnapshot {
    const agents = [...this.agents.values()];
    let totalTurns = 0;
    let totalUsd = 0;
    let anyOverBudget = false;
    for (const a of agents) {
      totalTurns += a.turnsUsed;
      totalUsd += a.usdSpent;
      if (a.overBudget) anyOverBudget = true;
    }
    totalUsd = Math.round(totalUsd * 1e6) / 1e6;
    return { totalTurns, totalUsd, anyOverBudget, agents };
  }
}
