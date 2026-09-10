/**
 * Flow B (Phase 7 spec, status_update): outbound call placed after a worker
 * accepts. Announces the worker, society, trade and arrival estimate, then
 * reads the start OTP twice; press 1 repeats, anything else (or silence)
 * ends the call. Requires ctx.activeJob — the transport resolves it before
 * dialing.
 */
import type { ActiveJob, Flow, FlowContext, FlowDeps, VoiceTurn } from '../types';

type Step = { name: 'announce' } | { name: 'done' };

export interface StatusUpdateState {
  step: Step;
  job: ActiveJob;
}

function announceTurn(job: ActiveJob, startOtp: string): VoiceTurn {
  return {
    prompts: [
      {
        key: 'voice.status_update.announce',
        params: {
          workerName: job.workerName,
          societyName: job.societyName,
          trade: job.tradeCode,
          arrivalEstimateMinutes: job.arrivalEstimateMinutes ?? '',
        },
      },
      { key: 'voice.status_update.otp', params: { otp: startOtp } },
      { key: 'voice.status_update.otp', params: { otp: startOtp } },
      { key: 'voice.status_update.repeat_hint' },
    ],
    expect: { mode: 'dtmf', dtmfDigits: 1, maxSeconds: 10 },
    actions: [],
    end: false,
  };
}

const doneTurn: VoiceTurn = { prompts: [], expect: null, actions: [], end: true };

export const statusUpdateFlow: Flow<StatusUpdateState> = {
  id: 'status_update',

  initial(ctx: FlowContext): StatusUpdateState {
    const job = ctx.activeJob;
    if (!job) throw new Error('status_update flow requires ctx.activeJob');
    return { step: { name: 'announce' }, job };
  },

  step(state, event, deps) {
    return Promise.resolve(stepSync(state, event, deps));
  },
};

function stepSync(
  state: StatusUpdateState,
  event: Parameters<Flow<StatusUpdateState>['step']>[1],
  deps: FlowDeps,
): { state: StatusUpdateState; turn: VoiceTurn } {
  const { step, job } = state;

  switch (step.name) {
    case 'announce': {
      if (event.type === 'start' || (event.type === 'dtmf' && event.digits === '1')) {
        const startOtp = deps.codes.deriveJobOtp(job.bookingId, 'start');
        return { state, turn: announceTurn(job, startOtp) };
      }
      return { state: { step: { name: 'done' }, job }, turn: doneTurn };
    }

    case 'done':
      return { state, turn: doneTurn };

    default: {
      const exhaustive: never = step;
      throw new Error(`unhandled step ${JSON.stringify(exhaustive)}`);
    }
  }
}
