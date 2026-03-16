import { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';

// This screen exists so Expo Router doesn't show "route not found" when
// Phantom redirects back via deep link.
// We use navigation.goBack() (not Redirect) to pop this screen and return to the
// home screen WITH its existing state preserved — keeping the modal open
// so sdk.connect() can resolve and advance to the select-network step.
export default function WalletCallback() {
  const navigation = useNavigation();

  useEffect(() => {
    navigation.goBack();
  }, []);

  return null;
}
