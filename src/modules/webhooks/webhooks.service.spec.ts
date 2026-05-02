import { createHmac } from 'crypto';
import { WebhooksService } from './webhooks.service';

function createRepo() {
  return {
    findOne: jest.fn(),
    create: jest.fn((input) => input),
    save: jest.fn(async (input) => input),
  };
}

describe('WebhooksService Stripe lesson payments', () => {
  let lessonPaymentRepo: ReturnType<typeof createRepo>;
  let auditRepo: ReturnType<typeof createRepo>;
  let service: WebhooksService;

  beforeEach(() => {
    lessonPaymentRepo = createRepo();
    auditRepo = createRepo();
    service = new WebhooksService(
      createRepo() as any,
      createRepo() as any,
      createRepo() as any,
      auditRepo as any,
      createRepo() as any,
      { grantL2LBonusForPurchase: jest.fn() } as any,
      { getRepository: jest.fn(() => lessonPaymentRepo) } as any,
    );
  });

  it('verifies Stripe signatures and parses the raw event payload', () => {
    const payload = JSON.stringify({
      id: 'evt_checkout_paid',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_paid' } },
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const secret = 'whsec_test';
    const signature = createHmac('sha256', secret)
      .update(`${timestamp}.${payload}`)
      .digest('hex');

    const event = service.parseStripeEvent(
      Buffer.from(payload),
      `t=${timestamp},v1=${signature}`,
      secret,
    );

    expect(event.type).toBe('checkout.session.completed');
    expect(event.data?.object?.id).toBe('cs_paid');
  });

  it('marks an existing lesson payment captured from checkout.session.completed', async () => {
    const existing = {
      lessonId: 'lesson-1',
      provider: 'stripe',
      status: 'checkout_created',
      amountPence: 100,
      capturedAt: null,
    };
    lessonPaymentRepo.findOne.mockResolvedValueOnce(existing);

    const result = await service.handleStripe({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_paid',
          payment_status: 'paid',
          amount_total: 100,
          currency: 'gbp',
          payment_intent: 'pi_paid',
          metadata: {
            lesson_id: 'lesson-1',
            learner_user_id: 'learner-1',
          },
        },
      },
    });

    expect(result).toEqual({
      success: true,
      lessonId: 'lesson-1',
      status: 'captured',
    });
    expect(lessonPaymentRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        lessonId: 'lesson-1',
        status: 'captured',
        checkoutSessionId: 'cs_paid',
        paymentIntentId: 'pi_paid',
        transactionId: 'pi_paid',
        currencyCode: 'GBP',
        amountPence: 100,
        failureReason: null,
      }),
    );
    expect(auditRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'learner-1',
        action: 'LESSON_PAYMENT_STRIPE_WEBHOOK',
      }),
    );
  });

  it('creates a captured lesson payment from Stripe metadata when no local row exists yet', async () => {
    lessonPaymentRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    await service.handleStripe({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_new',
          payment_status: 'paid',
          client_reference_id: 'lesson-2',
          metadata: {},
        },
      },
    });

    expect(lessonPaymentRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ lessonId: 'lesson-2' }),
    );
    expect(lessonPaymentRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        lessonId: 'lesson-2',
        status: 'captured',
        checkoutSessionId: 'cs_new',
      }),
    );
  });
});
