import { Alert, type AlertButton } from 'react-native';

// react-native-web'de Alert.alert bir şey göstermez. Web sürümünde onay ve
// bilgi pencereleri tarayıcının kendi pencereleriyle gösterilir.
export function installWebAlert() {
  Alert.alert = (title: string, message?: string, buttons?: AlertButton[]) => {
    const text = [title, message].filter(Boolean).join('\n\n');
    if (!buttons || buttons.length <= 1) {
      window.alert(text);
      buttons?.[0]?.onPress?.();
      return;
    }
    const cancel = buttons.find((b) => b.style === 'cancel');
    // Birden fazla seçenek varsa iptal dışındaki ilk seçenek onaylanan eylemdir.
    const confirm = buttons.find((b) => b.style !== 'cancel');
    if (window.confirm(confirm?.text ? `${text}\n\n→ ${confirm.text}` : text)) confirm?.onPress?.();
    else cancel?.onPress?.();
  };
}
