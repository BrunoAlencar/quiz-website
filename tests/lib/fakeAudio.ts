import { vi } from "vitest";

class FakeParam {
  value = 0;
  setValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
  cancelScheduledValues = vi.fn();
}

class FakeNode {
  connectedTo: unknown = null;
  disconnect = vi.fn();
  connect<T>(target: T): T {
    this.connectedTo = target;
    return target;
  }
}

export class FakeGain extends FakeNode {
  gain = new FakeParam();
}

export class FakeOscillator extends FakeNode {
  type = "";
  frequency = { value: 0 };
  start = vi.fn();
  stop = vi.fn();
}

export interface FakeContext {
  currentTime: number;
  state: string;
  destination: object;
  oscillators: FakeOscillator[];
  gains: FakeGain[];
  resume: ReturnType<typeof vi.fn>;
}

/** Stubs `window.AudioContext` with a recording fake and returns the contexts created so far. */
export function installFakeAudio(initialState = "running"): FakeContext[] {
  const instances: FakeContext[] = [];
  class FakeAudioContext implements FakeContext {
    currentTime = 0;
    state = initialState;
    destination = {};
    oscillators: FakeOscillator[] = [];
    gains: FakeGain[] = [];
    resume = vi.fn(async () => {});
    constructor() {
      instances.push(this);
    }
    createOscillator(): FakeOscillator {
      const osc = new FakeOscillator();
      this.oscillators.push(osc);
      return osc;
    }
    createGain(): FakeGain {
      const gain = new FakeGain();
      this.gains.push(gain);
      return gain;
    }
  }
  vi.stubGlobal("window", { AudioContext: FakeAudioContext });
  return instances;
}
