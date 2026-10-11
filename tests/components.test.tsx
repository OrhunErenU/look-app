import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button } from '@/components/common/Button';
import { EmptyState } from '@/components/common/States';
import { TextField } from '@/components/common/TextField';

describe('Button', () => {
  it('dokunulduğunda işlemi çağırır', async () => {
    const onPress = jest.fn();
    await render(<Button title="Paylaş" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Paylaş' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('yüklenirken tekrar dokunmaya izin vermez', async () => {
    const onPress = jest.fn();
    await render(<Button title="Paylaş" onPress={onPress} loading />);
    await fireEvent.press(screen.getByRole('button', { name: 'Paylaş' }));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('TextField', () => {
  it('hata mesajını ve karakter sayacını gösterir', async () => {
    await render(<TextField label="Biyografi" value="merhaba" maxLength={160} showCount error="Çok uzun" onChangeText={() => {}} />);
    expect(screen.getByText('Çok uzun')).toBeTruthy();
    expect(screen.getByText('7/160')).toBeTruthy();
  });
});

describe('EmptyState', () => {
  it('kullanıcıya yapabileceği eylemi sunar', async () => {
    const onAction = jest.fn();
    await render(<EmptyState icon="people-outline" title="Ana sayfan henüz boş" actionTitle="Keşfet'e git" onAction={onAction} />);
    await fireEvent.press(screen.getByRole('button', { name: "Keşfet'e git" }));
    expect(onAction).toHaveBeenCalled();
  });
});
