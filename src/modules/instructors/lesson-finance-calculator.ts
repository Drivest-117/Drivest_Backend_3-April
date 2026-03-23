import { LessonStatus } from './entities/lesson.entity';
import {
  LessonFinanceBookingSource,
  LessonFinanceCommissionStatus,
  LessonFinancePayoutStatus,
} from './entities/lesson-finance-snapshot.entity';

export const MARKETPLACE_COMMISSION_BPS = 800;

export interface LessonFinanceComputationInput {
  bookingSource: LessonFinanceBookingSource;
  lessonStatus: LessonStatus;
  hourlyRatePence: number | null;
  durationMinutes: number | null;
  hasOpenDispute: boolean;
}

export interface LessonFinanceComputation {
  grossAmountPence: number | null;
  commissionPercentBasisPoints: number;
  commissionAmountPence: number | null;
  instructorNetAmountPence: number | null;
  commissionStatus: LessonFinanceCommissionStatus;
  payoutStatus: LessonFinancePayoutStatus;
  financeNotes: string | null;
}

export function calculateGrossAmountPence(
  hourlyRatePence: number | null,
  durationMinutes: number | null,
): number | null {
  if (
    !Number.isFinite(hourlyRatePence) ||
    !Number.isFinite(durationMinutes) ||
    !hourlyRatePence ||
    !durationMinutes ||
    hourlyRatePence <= 0 ||
    durationMinutes <= 0
  ) {
    return null;
  }
  const gross = Math.round((hourlyRatePence * durationMinutes) / 60);
  if (!Number.isFinite(gross) || gross <= 0) {
    return null;
  }
  return gross;
}

export function calculateCommissionAmountPence(
  grossAmountPence: number | null,
  commissionPercentBasisPoints: number,
): number | null {
  if (!Number.isFinite(grossAmountPence) || !grossAmountPence || grossAmountPence <= 0) {
    return null;
  }
  if (!Number.isFinite(commissionPercentBasisPoints) || commissionPercentBasisPoints <= 0) {
    return 0;
  }
  return Math.round((grossAmountPence * commissionPercentBasisPoints) / 10_000);
}

function deriveCommissionStatus(
  input: LessonFinanceComputationInput,
  grossAmountPence: number | null,
): LessonFinanceCommissionStatus {
  if (input.bookingSource !== 'marketplace') {
    return input.lessonStatus === 'cancelled' || input.lessonStatus === 'declined'
      ? 'voided'
      : 'not_applicable';
  }
  if (input.lessonStatus === 'cancelled' || input.lessonStatus === 'declined') {
    return 'voided';
  }
  if (input.hasOpenDispute) {
    return 'disputed';
  }
  if (grossAmountPence === null) {
    return 'estimated';
  }
  return 'ready';
}

function derivePayoutStatus(
  input: LessonFinanceComputationInput,
  grossAmountPence: number | null,
): LessonFinancePayoutStatus {
  if (input.bookingSource !== 'marketplace') {
    return input.lessonStatus === 'cancelled' || input.lessonStatus === 'declined'
      ? 'voided'
      : 'not_applicable';
  }
  if (input.lessonStatus === 'cancelled' || input.lessonStatus === 'declined') {
    return 'voided';
  }
  if (input.hasOpenDispute) {
    return 'on_hold';
  }
  if (input.lessonStatus === 'completed' && grossAmountPence !== null) {
    return 'ready_for_manual_payout';
  }
  return 'pending';
}

export function computeLessonFinance(input: LessonFinanceComputationInput): LessonFinanceComputation {
  const grossAmountPence = calculateGrossAmountPence(input.hourlyRatePence, input.durationMinutes);
  const commissionPercentBasisPoints =
    input.bookingSource === 'marketplace' ? MARKETPLACE_COMMISSION_BPS : 0;
  const commissionAmountPence = calculateCommissionAmountPence(
    grossAmountPence,
    commissionPercentBasisPoints,
  );
  const instructorNetAmountPence =
    grossAmountPence !== null && commissionAmountPence !== null
      ? grossAmountPence - commissionAmountPence
      : null;

  const commissionStatus = deriveCommissionStatus(input, grossAmountPence);
  const payoutStatus = derivePayoutStatus(input, grossAmountPence);

  let financeNotes: string | null = null;
  if (grossAmountPence === null) {
    financeNotes = 'Finance estimate is pending instructor hourly rate or lesson duration data.';
  } else if (input.hasOpenDispute) {
    financeNotes = 'Payout status is on hold while a dispute is open.';
  }

  return {
    grossAmountPence,
    commissionPercentBasisPoints,
    commissionAmountPence,
    instructorNetAmountPence,
    commissionStatus,
    payoutStatus,
    financeNotes,
  };
}
