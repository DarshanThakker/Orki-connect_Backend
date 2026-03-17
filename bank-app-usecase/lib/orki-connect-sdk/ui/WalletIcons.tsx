import React from 'react';
import Svg, { Path, Defs, LinearGradient, Stop, G, ClipPath, Rect } from 'react-native-svg';

interface IconProps { size?: number }

export function PhantomIcon({ size = 36 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        fill="#AB9FF2"
        d="M5.13 19.2c2.297 0 4.023-1.92 5.053-3.436a2.9 2.9 0 0 0-.195.994c0 .885.53 1.516 1.574 1.516 1.433 0 2.965-1.208 3.758-2.51a2 2 0 0 0-.083.524c0 .617.362 1.006 1.1 1.006 2.324 0 4.663-3.959 4.663-7.421C21 7.175 19.58 4.8 16.016 4.8 9.752 4.8 3 12.154 3 16.905 3 18.771 4.044 19.2 5.13 19.2m8.729-9.622c0-.671.39-1.141.96-1.141.557 0 .947.47.947 1.14 0 .672-.39 1.155-.947 1.155-.57 0-.96-.483-.96-1.154m2.979 0c0-.671.39-1.141.96-1.141.557 0 .947.47.947 1.14 0 .672-.39 1.155-.947 1.155-.57 0-.96-.483-.96-1.154"
      />
    </Svg>
  );
}

export function MetaMaskIcon({ size = 36 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path fill="#FF5C16" d="m19.821 19.918-3.877-1.131-2.924 1.712h-2.04l-2.926-1.712-3.875 1.13L3 16.02l1.179-4.327L3 8.034 4.179 3.5l6.056 3.544h3.53L19.821 3.5 21 8.034l-1.179 3.658L21 16.02z" />
      <Path fill="#FF5C16" d="m4.18 3.5 6.055 3.547-.24 2.434zm3.875 12.52 2.665 1.99-2.665.777zm2.452-3.286-.512-3.251-3.278 2.21h-.002v.001l.01 2.275 1.33-1.235zM19.82 3.5l-6.056 3.547.24 2.434zm-3.875 12.52-2.665 1.99 2.665.777zm1.339-4.326v-.002zl-3.279-2.21-.512 3.25h2.451l1.33 1.236z" />
      <Path fill="#E34807" d="m8.054 18.787-3.875 1.13L3 16.022h5.054zm2.452-6.054.74 4.7-1.026-2.614-3.497-.85 1.33-1.236zm5.44 6.054 3.875 1.13L21 16.022h-5.055zm-2.452-6.054-.74 4.7 1.026-2.614 3.497-.85-1.331-1.236z" />
      <Path fill="#FF8D5D" d="m3 16.02 1.179-4.328h2.535l.01 2.276 3.496.85 1.026 2.613-.527.576-2.665-1.989H3zm18 0-1.179-4.328h-2.535l-.01 2.276-3.496.85-1.026 2.613.527.576 2.665-1.989H21zm-7.235-8.976h-3.53l-.24 2.435 1.251 7.95h1.508l1.252-7.95z" />
      <Path fill="#661800" d="M4.179 3.5 3 8.034l1.179 3.658h2.535l3.28-2.211zm5.594 10.177H8.625l-.626.6 2.222.54zM19.821 3.5 21 8.034l-1.179 3.658h-2.535l-3.28-2.211zm-5.593 10.177h1.15l.626.6-2.224.541zm-1.209 5.271.262-.94-.527-.575h-1.509l-.527.575.262.94" />
      <Path fill="#C0C4CD" d="M13.02 18.948V20.5h-2.04v-1.552z" />
      <Path fill="#E7EBF6" d="m8.055 18.785 2.927 1.714v-1.552l-.262-.94zm7.89 0L13.02 20.5v-1.552l.262-.94z" />
    </Svg>
  );
}

export function CoinbaseIcon({ size = 36 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path fill="#0E5BFF" d="M3 12a9 9 0 1 1 18 0 9 9 0 0 1-18 0" />
      <Path fill="#fff" fillRule="evenodd" clipRule="evenodd" d="M12 18.375a6.375 6.375 0 1 0 0-12.75 6.375 6.375 0 0 0 0 12.75m-.75-8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125h1.5c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125z" />
    </Svg>
  );
}

export function TrustWalletIcon({ size = 36 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Defs>
        <LinearGradient id="trust__a" x1="17.948" x2="11.967" y1="1.74" y2="20.797" gradientUnits="userSpaceOnUse">
          <Stop offset="0.02" stopColor="#00F" />
          <Stop offset="0.08" stopColor="#0094FF" />
          <Stop offset="0.16" stopColor="#48FF91" />
          <Stop offset="0.42" stopColor="#0094FF" />
          <Stop offset="0.68" stopColor="#0038FF" />
          <Stop offset="0.9"  stopColor="#0500FF" />
        </LinearGradient>
      </Defs>
      <Path fill="#0500FF" d="M3.9 5.6 12 3v18c-5.786-2.4-8.1-7-8.1-9.6z" />
      <Path fill="url(#trust__a)" d="M20.1 5.6 12 3v18c5.786-2.4 8.1-7 8.1-9.6z" />
    </Svg>
  );
}

export function BinanceIcon({ size = 36 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path fill="#F0B90B" d="m7.068 12-2.03 2.03L3.003 12l2.03-2.03zm4.935-4.935 3.482 3.483 2.03-2.03L12.003 3 6.485 8.518l2.03 2.03zm6.964 2.905L16.937 12l2.03 2.03 2.03-2.03zm-6.964 6.965L8.52 13.452l-2.03 2.03L12.003 21l5.512-5.518-2.03-2.03zm0-2.905 2.03-2.03-2.03-2.03L9.967 12z" />
    </Svg>
  );
}

export function WalletConnectIcon({ size = 36 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Defs>
        <ClipPath id="wallet-connect__a">
          <Rect width="24" height="24" fill="#fff" />
        </ClipPath>
      </Defs>
      <G clipPath="url(#wallet-connect__a)">
        <Rect width="24" height="24" fill="#3B99FC" />
        <Path
          fill="#fff"
          d="M7.276 9.076c2.609-2.501 6.84-2.501 9.449 0l.313.3a.31.31 0 0 1 0 .453l-1.074 1.03a.17.17 0 0 1-.236 0l-.432-.414c-1.82-1.745-4.772-1.745-6.592 0l-.463.444a.17.17 0 0 1-.236 0l-1.074-1.03a.31.31 0 0 1 0-.453zm11.67 2.129.956.916a.31.31 0 0 1 0 .453l-4.31 4.132a.344.344 0 0 1-.473 0l-3.06-2.932a.086.086 0 0 0-.118 0l-3.06 2.932a.344.344 0 0 1-.472 0l-4.311-4.132a.31.31 0 0 1 0-.453l.956-.916a.344.344 0 0 1 .472 0l3.06 2.933a.086.086 0 0 0 .118 0l3.06-2.933a.344.344 0 0 1 .472 0l3.06 2.933a.086.086 0 0 0 .118 0l3.06-2.933a.345.345 0 0 1 .472 0"
        />
      </G>
    </Svg>
  );
}

export function WalletIcon({ walletId, size = 36 }: { walletId: string; size?: number }) {
  switch (walletId) {
    case 'phantom':        return <PhantomIcon size={size} />;
    case 'metamask':       return <MetaMaskIcon size={size} />;
    case 'coinbase':       return <CoinbaseIcon size={size} />;
    case 'trust':          return <TrustWalletIcon size={size} />;
    case 'binance':        return <BinanceIcon size={size} />;
    case 'walletconnect':  return <WalletConnectIcon size={size} />;
    default:               return null;
  }
}
