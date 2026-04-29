import { NotFoundException } from '@nestjs/common';
import { PublicLegalService } from './public-legal.service';

describe('PublicLegalService', () => {
  let service: PublicLegalService;

  beforeEach(() => {
    service = new PublicLegalService();
  });

  it('renders localized public legal content as html', () => {
    const html = service.renderPublicDocument('terms-and-conditions', 'fr');

    expect(html).toContain('<html lang="fr" dir="ltr">');
    expect(html).toContain('Conditions générales complètes');
    expect(html).toContain('Drivest Limited');
  });

  it('renders rtl locales with rtl direction', () => {
    const html = service.renderPublicDocument('privacy-policy', 'ar');

    expect(html).toContain('<html lang="ar" dir="rtl">');
  });

  it('rejects missing localized variants', () => {
    expect(() => service.renderPublicDocument('terms-and-conditions', 'xx')).toThrow(NotFoundException);
  });
});
