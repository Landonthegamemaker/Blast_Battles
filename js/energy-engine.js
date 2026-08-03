'use strict';
/**
 * energy-engine.js — pure resource-math core for the Energy/Stamina system.
 * No DOM, no globals — testable in isolation before wiring into game-state.js.
 */

const ACTION_ENERGY_COST = {
  move: 1,
  melee: 1,
  pistol: 2,
  revolver: 2,
  assault_rifle: 3,
  shotgun: 4,
  sniper: 5,
  explosive: 6,
  missile: 7,
};

const K_DRAIN = 1;
const K_RECOVER = 1;

/** Energy granted at the start of turn N (only while NOT locked out — see beginTurn). */
function getEnergyIncome(turn) {
  return turn;
}

/** Stamina needed to clear lockout: 50% of Speed, rounded up. */
function getLockoutClearThreshold(speed) {
  return Math.ceil(speed * 0.5);
}

/** Cost of a given weapon subtype (or 'move'/'melee'). Throws on unknown subtype. */
function getActionCost(subtypeOrAction) {
  const cost = ACTION_ENERGY_COST[subtypeOrAction];
  if (cost === undefined) {
    throw new Error(`Unknown action/subtype: ${subtypeOrAction}`);
  }
  return cost;
}

function canAfford(energyBalance, cost) {
  return energyBalance >= cost;
}

/** Creates a fresh resource state for one character. */
function createResourceState() {
  return {
    energy: 0,
    stamina: 100,
    spentThisTurn: 0,
    lockedOut: false,
  };
}

/**
 * Call once per turn, before any spending.
 *
 * While NOT locked out: normal Energy income (= turn number) accrues, banked on top of
 * whatever's left unspent from prior turns.
 *
 * While locked out: Energy flow is cut off entirely (no income, balance forced to 0).
 * Instead Stamina gains a flat +1. Once Stamina reaches getLockoutClearThreshold(speed),
 * lockout clears and normal income resumes next turn.
 */
function beginTurn(state, turn, speed) {
  if (state.lockedOut) {
    state.energy = 0;
    state.stamina = Math.min(100, state.stamina + 1);
    if (state.stamina >= getLockoutClearThreshold(speed)) {
      state.lockedOut = false;
    }
  } else {
    state.energy += getEnergyIncome(turn);
  }
  return state;
}

/**
 * Attempts to spend Energy on an action. Returns true and mutates state if affordable,
 * false (no mutation) if not. Should only be called when canAct(state) is true.
 */
function trySpend(state, cost) {
  if (!canAfford(state.energy, cost)) return false;
  state.energy -= cost;
  state.spentThisTurn += cost;
  return true;
}

/**
 * Call once per turn, after spending is done, while NOT locked out (lockout recovery is
 * handled entirely in beginTurn -- this is a no-op if somehow called while locked out).
 *
 * stored = whatever's left in the bank after this turn's spending (persists forward --
 * NOT reset to 0; it keeps generating recovery every turn it remains unspent).
 */
function endTurn(state, speed, kDrain = K_DRAIN, kRecover = K_RECOVER) {
  if (state.lockedOut) {
    state.spentThisTurn = 0;
    return {
      stored: 0, drain: 0, recovery: 0, net: 0,
      staminaBefore: state.stamina, staminaAfter: state.stamina, lockoutRecoveryTick: true,
    };
  }

  const stored = state.energy;
  const drain = state.spentThisTurn * speed * kDrain;
  const recovery = stored * kRecover;
  const net = recovery - drain;

  const before = state.stamina;
  state.stamina = Math.max(0, Math.min(100, state.stamina + net));
  if (state.stamina === 0) {
    state.lockedOut = true;
  }

  const breakdown = {
    stored, drain, recovery, net,
    staminaBefore: before, staminaAfter: state.stamina, lockoutRecoveryTick: false,
  };
  state.spentThisTurn = 0;
  return breakdown;
}

/** Can this character act at all right now? */
function canAct(state) {
  return !state.lockedOut;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ACTION_ENERGY_COST, K_DRAIN, K_RECOVER,
    getEnergyIncome, getLockoutClearThreshold, getActionCost, canAfford, createResourceState,
    beginTurn, trySpend, endTurn, canAct,
  };
} else if (typeof window !== 'undefined') {
  window.createResourceState = createResourceState;
  window.beginTurn = beginTurn;
  window.trySpend = trySpend;
  window.endTurn = endTurn;
  window.canAct = canAct;
  window.canAfford = canAfford;
  window.getActionCost = getActionCost;
}
