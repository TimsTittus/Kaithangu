/**
 * Flow C (Phase 7 spec, worker_offer): outbound call announcing a new job.
 * Press 1 to accept, 2 to decline; no input in 20s times out with neither
 * action (the offer simply expires elsewhere). Requires ctx.offer.
 */
import type { Flow, FlowContext, JobOffer, VoiceTurn } from '../types';

type Step = { name: 'offer' } | { name: 'done' };

export interface WorkerOfferState {
  step: Step;
  offer: JobOffer;
}

function offerTurn(offer: JobOffer): VoiceTurn {
  return {
    prompts: [
      {
        key: 'voice.worker_offer.announce',
        params: { trade: offer.tradeCode, locality: offer.locality, distanceKm: offer.distanceKm, wagePaise: offer.wagePaise },
      },
    ],
    expect: { mode: 'dtmf', dtmfDigits: 1, maxSeconds: 20 },
    actions: [],
    end: false,
  };
}

const doneTurn: VoiceTurn = { prompts: [], expect: null, actions: [], end: true };

export const workerOfferFlow: Flow<WorkerOfferState> = {
  id: 'worker_offer',

  initial(ctx: FlowContext): WorkerOfferState {
    const offer = ctx.offer;
    if (!offer) throw new Error('worker_offer flow requires ctx.offer');
    return { step: { name: 'offer' }, offer };
  },

  step(state, event) {
    return Promise.resolve(stepSync(state, event));
  },
};

function stepSync(
  state: WorkerOfferState,
  event: Parameters<Flow<WorkerOfferState>['step']>[1],
): { state: WorkerOfferState; turn: VoiceTurn } {
  const { step, offer } = state;

    switch (step.name) {
      case 'offer': {
        if (event.type === 'start') return { state, turn: offerTurn(offer) };

        if (event.type === 'dtmf' && event.digits === '1') {
          return {
            state: { step: { name: 'done' }, offer },
            turn: {
              prompts: [{ key: 'voice.worker_offer.accepted' }],
              expect: null,
              actions: [{ type: 'acceptOffer', offerId: offer.offerId }],
              end: true,
            },
          };
        }

        if (event.type === 'dtmf' && event.digits === '2') {
          return {
            state: { step: { name: 'done' }, offer },
            turn: {
              prompts: [{ key: 'voice.worker_offer.declined' }],
              expect: null,
              actions: [{ type: 'declineOffer', offerId: offer.offerId }],
              end: true,
            },
          };
        }

        if (event.type === 'timeout' || event.type === 'hangup') {
          return { state: { step: { name: 'done' }, offer }, turn: doneTurn };
        }

        return { state, turn: offerTurn(offer) };
      }

      case 'done':
        return { state, turn: doneTurn };

    default: {
      const exhaustive: never = step;
      throw new Error(`unhandled step ${JSON.stringify(exhaustive)}`);
    }
  }
}
