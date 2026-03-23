import {
  calculateCommissionAmountPence,
  calculateGrossAmountPence,
  computeLessonFinance,
} from './lesson-finance-calculator';

describe('lesson-finance-calculator', () => {
  it('calculates gross amount from hourly rate and duration', () => {
    expect(calculateGrossAmountPence(4200, 60)).toBe(4200);
    expect(calculateGrossAmountPence(4200, 90)).toBe(6300);
  });

  it('returns null gross amount when required fields are missing', () => {
    expect(calculateGrossAmountPence(null, 60)).toBeNull();
    expect(calculateGrossAmountPence(4200, null)).toBeNull();
    expect(calculateGrossAmountPence(0, 60)).toBeNull();
  });

  it('applies zero commission for non-marketplace booking sources', () => {
    const result = computeLessonFinance({
      bookingSource: 'direct_instructor',
      lessonStatus: 'requested',
      hourlyRatePence: 4200,
      durationMinutes: 60,
      hasOpenDispute: false,
    });
    expect(result.commissionPercentBasisPoints).toBe(0);
    expect(result.commissionAmountPence).toBe(0);
    expect(result.commissionStatus).toBe('not_applicable');
    expect(result.payoutStatus).toBe('not_applicable');
  });

  it('transitions marketplace payout status on completed and cancelled lessons', () => {
    const completed = computeLessonFinance({
      bookingSource: 'marketplace',
      lessonStatus: 'completed',
      hourlyRatePence: 4200,
      durationMinutes: 60,
      hasOpenDispute: false,
    });
    expect(completed.payoutStatus).toBe('ready_for_manual_payout');
    expect(completed.commissionStatus).toBe('ready');

    const cancelled = computeLessonFinance({
      bookingSource: 'marketplace',
      lessonStatus: 'cancelled',
      hourlyRatePence: 4200,
      durationMinutes: 60,
      hasOpenDispute: false,
    });
    expect(cancelled.payoutStatus).toBe('voided');
    expect(cancelled.commissionStatus).toBe('voided');
  });

  it('moves payout status to on_hold when a dispute is open', () => {
    const disputed = computeLessonFinance({
      bookingSource: 'marketplace',
      lessonStatus: 'accepted',
      hourlyRatePence: 4200,
      durationMinutes: 60,
      hasOpenDispute: true,
    });
    expect(disputed.payoutStatus).toBe('on_hold');
    expect(disputed.commissionStatus).toBe('disputed');
  });

  it('calculates commission from basis points', () => {
    expect(calculateCommissionAmountPence(3500, 800)).toBe(280);
    expect(calculateCommissionAmountPence(3500, 0)).toBe(0);
    expect(calculateCommissionAmountPence(null, 800)).toBeNull();
  });
});
