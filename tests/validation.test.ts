import {
  ageOn,
  normalizeUsername,
  parseTurkishDate,
  validateBirthDate,
  validateEmail,
  validatePassword,
  validateUsername,
} from '@/utils/validation';

describe('kullanıcı adı', () => {
  it('büyük/küçük harf farkını ve @ önekini yok sayar', () => {
    expect(normalizeUsername('  @OrhunLook ')).toBe('orhunlook');
    expect(normalizeUsername('orhunlook')).toBe(normalizeUsername('OrhunLook'));
  });

  it('geçerli adları kabul eder', () => {
    expect(validateUsername('orhun.look')).toBeNull();
    expect(validateUsername('look_2026')).toBeNull();
  });

  it('geçersiz adları reddeder', () => {
    expect(validateUsername('ab')).not.toBeNull();
    expect(validateUsername('a'.repeat(31))).not.toBeNull();
    expect(validateUsername('orhun look')).not.toBeNull();
    expect(validateUsername('çağrı')).not.toBeNull();
    expect(validateUsername('.orhun')).not.toBeNull();
    expect(validateUsername('orhun.')).not.toBeNull();
    expect(validateUsername('or..hun')).not.toBeNull();
  });
});

describe('e-posta ve parola', () => {
  it('e-posta biçimini kontrol eder', () => {
    expect(validateEmail('a@b.co')).toBeNull();
    expect(validateEmail('')).not.toBeNull();
    expect(validateEmail('not-an-email')).not.toBeNull();
  });

  it('parola en az 8 karakter, harf ve rakam içermeli', () => {
    expect(validatePassword('abc12345')).toBeNull();
    expect(validatePassword('abc123')).not.toBeNull();
    expect(validatePassword('abcdefgh')).not.toBeNull();
    expect(validatePassword('12345678')).not.toBeNull();
  });
});

describe('doğum tarihi', () => {
  const today = new Date(2026, 9, 11); // 11 Ekim 2026

  it('GG.AA.YYYY biçimini ISO tarihe çevirir', () => {
    expect(parseTurkishDate('01.02.2000')).toBe('2000-02-01');
    expect(parseTurkishDate('1/2/2000')).toBe('2000-02-01');
    expect(parseTurkishDate('31.02.2000')).toBeNull();
    expect(parseTurkishDate('2000-02-01')).toBeNull();
  });

  it('yaşı doğum gününe göre hesaplar', () => {
    expect(ageOn('2008-10-11', today)).toBe(18);
    expect(ageOn('2008-10-12', today)).toBe(17);
  });

  it('18 yaş altını reddeder', () => {
    expect(validateBirthDate('11.10.2008', today)).toBeNull();
    expect(validateBirthDate('12.10.2008', today)).toMatch(/18/);
    expect(validateBirthDate('01.01.1800', today)).not.toBeNull();
  });
});
