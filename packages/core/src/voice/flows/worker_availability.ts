/**
 * Flow D (Phase 7 spec, worker_availability): outbound 07:00 daily call for
 * workers with has_smartphone=false, and the same menu offered as an inbound
 * option. Press 1 available today, 2 not.
 */
import type { Flow, FlowContext, VoiceTurn } from '../types';

type Step = { name: 'ask' } | { name: 'done' };

export interface WorkerAvailabilityState {
  step: Step;
  workerId: string;
}

const askTurn: VoiceTurn = {
  prompts: [{ key: 'voice.worker_availability.ask' }],
  expect: { mode: 'dtmf', dtmfDigits: 1, maxSeconds: 8 },
  actions: [],
  end: false,
};

const doneTurn: VoiceTurn = { prompts: [], expect: null, actions: [], end: true };

export const workerAvailabilityFlow: Flow<WorkerAvailabilityState> = {
  id: 'worker_availability',

  initial(ctx: FlowContext): WorkerAvailabilityState {
    if (!ctx.workerId) throw new Error('worker_availability flow requires ctx.workerId');
    return { step: { name: 'ask' }, workerId: ctx.workerId };
  },

  step(state, event) {
    return Promise.resolve(stepSync(state, event));
  },
};

function stepSync(
  state: WorkerAvailabilityState,
  event: Parameters<Flow<WorkerAvailabilityState>['step']>[1],
): { state: WorkerAvailabilityState; turn: VoiceTurn } {
  const { step, workerId } = state;

  switch (step.name) {
    case 'ask': {
      if (event.type === 'start') return { state, turn: askTurn };

      if (event.type === 'dtmf' && (event.digits === '1' || event.digits === '2')) {
        const available = event.digits === '1';
        return {
          state: { step: { name: 'done' }, workerId },
          turn: {
            prompts: [
              {
                key: available
                  ? 'voice.worker_availability.confirmed_available'
                  : 'voice.worker_availability.confirmed_unavailable',
              },
            ],
            expect: null,
            actions: [{ type: 'setAvailability', available }],
            end: true,
          },
        };
      }

      if (event.type === 'timeout' || event.type === 'hangup') {
        return { state: { step: { name: 'done' }, workerId }, turn: doneTurn };
      }

      return { state, turn: askTurn };
    }

    case 'done':
      return { state, turn: doneTurn };

    default: {
      const exhaustive: never = step;
      throw new Error(`unhandled step ${JSON.stringify(exhaustive)}`);
    }
  }
}
