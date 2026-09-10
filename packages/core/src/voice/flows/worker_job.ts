/**
 * Flow E (Phase 7 spec, worker_job): inbound call from a known worker phone
 * with an active job. Menu: 1 on the way, 2 start job (customer's 4-digit
 * start code), 3 complete job (completion code), 4 today's earnings.
 * Requires ctx.activeJob and ctx.workerId.
 */
import { JOB_OTP_DIGITS } from '../../otp';
import type { ActiveJob, Flow, FlowContext, FlowDeps, VoiceTurn } from '../types';

type Step =
  | { name: 'menu' }
  | { name: 'start_code' }
  | { name: 'complete_code' }
  | { name: 'done' };

export interface WorkerJobState {
  step: Step;
  job: ActiveJob;
}

const menuTurn: VoiceTurn = {
  prompts: [{ key: 'voice.worker_job.menu' }],
  expect: { mode: 'dtmf', dtmfDigits: 1, maxSeconds: 10 },
  actions: [],
  end: false,
};

const startCodeTurn: VoiceTurn = {
  prompts: [{ key: 'voice.worker_job.ask_start_code' }],
  expect: { mode: 'dtmf', dtmfDigits: JOB_OTP_DIGITS, maxSeconds: 20 },
  actions: [],
  end: false,
};

const invalidStartCodeTurn: VoiceTurn = {
  prompts: [{ key: 'voice.worker_job.invalid_code' }, { key: 'voice.worker_job.ask_start_code' }],
  expect: { mode: 'dtmf', dtmfDigits: JOB_OTP_DIGITS, maxSeconds: 20 },
  actions: [],
  end: false,
};

const completeCodeTurn: VoiceTurn = {
  prompts: [{ key: 'voice.worker_job.ask_complete_code' }],
  expect: { mode: 'dtmf', dtmfDigits: JOB_OTP_DIGITS, maxSeconds: 20 },
  actions: [],
  end: false,
};

const invalidCompleteCodeTurn: VoiceTurn = {
  prompts: [{ key: 'voice.worker_job.invalid_code' }, { key: 'voice.worker_job.ask_complete_code' }],
  expect: { mode: 'dtmf', dtmfDigits: JOB_OTP_DIGITS, maxSeconds: 20 },
  actions: [],
  end: false,
};

const doneTurn: VoiceTurn = { prompts: [], expect: null, actions: [], end: true };

function onTheWayTurn(): VoiceTurn {
  return {
    prompts: [{ key: 'voice.worker_job.on_the_way_ack' }, { key: 'voice.worker_job.menu' }],
    expect: { mode: 'dtmf', dtmfDigits: 1, maxSeconds: 10 },
    actions: [],
    end: false,
  };
}

async function earningsTurn(job: ActiveJob, deps: FlowDeps): Promise<VoiceTurn> {
  const earnings = await deps.earnings.today(job.workerId);
  return {
    prompts: [
      { key: 'voice.worker_job.earnings', params: { totalPaise: earnings.totalPaise, jobCount: earnings.jobCount } },
      { key: 'voice.worker_job.menu' },
    ],
    expect: { mode: 'dtmf', dtmfDigits: 1, maxSeconds: 10 },
    actions: [],
    end: false,
  };
}

export const workerJobFlow: Flow<WorkerJobState> = {
  id: 'worker_job',

  initial(ctx: FlowContext): WorkerJobState {
    if (!ctx.activeJob) throw new Error('worker_job flow requires ctx.activeJob');
    return { step: { name: 'menu' }, job: ctx.activeJob };
  },

  async step(state, event, deps: FlowDeps) {
    const { step, job } = state;

    switch (step.name) {
      case 'menu': {
        if (event.type === 'start') return { state, turn: menuTurn };
        if (event.type !== 'dtmf') {
          if (event.type === 'timeout' || event.type === 'hangup') {
            return { state: { step: { name: 'done' }, job }, turn: doneTurn };
          }
          return { state, turn: menuTurn };
        }

        switch (event.digits) {
          case '1':
            return { state, turn: onTheWayTurn() };
          case '2':
            return { state: { step: { name: 'start_code' }, job }, turn: startCodeTurn };
          case '3':
            return { state: { step: { name: 'complete_code' }, job }, turn: completeCodeTurn };
          case '4':
            return { state, turn: await earningsTurn(job, deps) };
          default:
            return { state, turn: menuTurn };
        }
      }

      case 'start_code': {
        if (event.type !== 'dtmf' || event.digits.length !== JOB_OTP_DIGITS) {
          if (event.type === 'timeout' || event.type === 'hangup') {
            return { state: { step: { name: 'done' }, job }, turn: doneTurn };
          }
          return { state, turn: startCodeTurn };
        }
        if (!deps.codes.verifyJobOtp(job.bookingId, 'start', event.digits)) {
          return { state, turn: invalidStartCodeTurn };
        }
        return {
          state: { step: { name: 'done' }, job },
          turn: {
            prompts: [{ key: 'voice.worker_job.start_confirmed' }],
            expect: null,
            actions: [{ type: 'startJob', otp: event.digits }],
            end: true,
          },
        };
      }

      case 'complete_code': {
        if (event.type !== 'dtmf' || event.digits.length !== JOB_OTP_DIGITS) {
          if (event.type === 'timeout' || event.type === 'hangup') {
            return { state: { step: { name: 'done' }, job }, turn: doneTurn };
          }
          return { state, turn: completeCodeTurn };
        }
        if (!deps.codes.verifyJobOtp(job.bookingId, 'complete', event.digits)) {
          return { state, turn: invalidCompleteCodeTurn };
        }
        return {
          state: { step: { name: 'done' }, job },
          turn: {
            prompts: [{ key: 'voice.worker_job.complete_confirmed' }],
            expect: null,
            actions: [{ type: 'completeJob', otp: event.digits }],
            end: true,
          },
        };
      }

      case 'done':
        return { state, turn: doneTurn };

      default: {
        const exhaustive: never = step;
        throw new Error(`unhandled step ${JSON.stringify(exhaustive)}`);
      }
    }
  },
};
