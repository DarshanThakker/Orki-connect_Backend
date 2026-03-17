import React from 'react';
import Svg, { Path, G, Defs, LinearGradient, Stop, ClipPath } from 'react-native-svg';

interface IconProps { size?: number }

export function EthereumIcon({ size = 36 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path fill="#8FFCF3" d="M12 3v6.651l5.625 2.516z" />
      <Path fill="#CABCF8" d="m12 3-5.625 9.166L12 9.653z" />
      <Path fill="#CBA7F5" d="M12 16.478V21l5.625-7.784z" />
      <Path fill="#74A0F3" d="M12 21v-4.522l-5.625-3.262z" />
      <Path fill="#CBA7F5" d="m12 15.43 5.625-3.263L12 9.652z" />
      <Path fill="#74A0F3" d="M6.375 12.167 12 15.43V9.652z" />
      <Path fill="#202699" fillRule="evenodd" clipRule="evenodd" d="m12 15.43-5.625-3.263L12 3l5.624 9.166zm-5.252-3.528 5.161-8.41v6.114zm-.077.229 5.238-2.327v5.364zm5.418-2.327v5.364l5.234-3.037zm0-.198 5.161 2.296-5.161-8.41z" />
      <Path fill="#202699" fillRule="evenodd" clipRule="evenodd" d="m12 16.406-5.625-3.195L12 21l5.624-7.79zm-4.995-2.633 4.904 2.79v4.005zm5.084 2.79v4.005l4.905-6.795z" />
    </Svg>
  );
}

export function SolanaIcon({ size = 36 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Defs>
        <LinearGradient id="solana__a" x1="3.001" x2="21.459" y1="55.041" y2="54.871" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#599DB0" />
          <Stop offset="1" stopColor="#47F8C3" />
        </LinearGradient>
        <LinearGradient id="solana__b" x1="3.001" x2="21.341" y1="9.168" y2="9.027" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#C44FE2" />
          <Stop offset="1" stopColor="#73B0D0" />
        </LinearGradient>
        <LinearGradient id="solana__c" x1="4.036" x2="20.303" y1="12.003" y2="12.003" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#778CBF" />
          <Stop offset="1" stopColor="#5DCDC9" />
        </LinearGradient>
      </Defs>
      <Path fill="url(#solana__a)" d="M18.413 7.902a.62.62 0 0 1-.411.163H3.58c-.512 0-.77-.585-.416-.928l2.369-2.284a.6.6 0 0 1 .41-.169H20.42c.517 0 .77.59.41.935z" />
      <Path fill="url(#solana__b)" d="M18.413 19.158a.62.62 0 0 1-.411.158H3.58c-.512 0-.77-.58-.416-.923l2.369-2.29a.6.6 0 0 1 .41-.163H20.42c.517 0 .77.586.41.928z" />
      <Path fill="url(#solana__c)" d="M18.413 10.473a.62.62 0 0 0-.411-.158H3.58c-.512 0-.77.58-.416.923l2.369 2.29c.111.103.257.16.41.163H20.42c.517 0 .77-.586.41-.928z" />
    </Svg>
  );
}

export function PolygonIcon({ size = 36 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Defs>
        <LinearGradient id="polygon__a" x1="2.942" x2="20.119" y1="17.194" y2="7.101" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#A726C1" />
          <Stop offset="0.88" stopColor="#803BDF" />
          <Stop offset="1" stopColor="#7B3FE4" />
        </LinearGradient>
      </Defs>
      <Path fill="url(#polygon__a)" d="m16.364 15.217 4.27-2.435a.73.73 0 0 0 .366-.627V7.284a.72.72 0 0 0-.366-.627l-4.27-2.435a.74.74 0 0 0-.732 0l-4.27 2.435a.72.72 0 0 0-.366.627v8.704l-2.994 1.707-2.994-1.707v-3.415l2.994-1.707 1.974 1.127V9.702l-1.608-.918a.75.75 0 0 0-.732 0l-4.27 2.435a.72.72 0 0 0-.366.627v4.87c0 .258.14.498.366.627l4.27 2.436a.75.75 0 0 0 .732 0l4.27-2.436a.72.72 0 0 0 .366-.626V8.012l.053-.03 2.94-1.677 2.994 1.707v3.415l-2.994 1.707-1.972-1.124v2.291l1.606.916a.75.75 0 0 0 .732 0z" />
    </Svg>
  );
}

export function BaseIcon({ size = 36 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Defs>
        <ClipPath id="base__a">
          <Path fill="#fff" d="M0 0h24v24H0z" />
        </ClipPath>
      </Defs>
      <G clipPath="url(#base__a)">
        <Path fill="#00F" d="M24 0H0v24h24z" />
        <Path fill="#fff" d="M4 5.517c0-.52 0-.78.098-.98a.96.96 0 0 1 .44-.44C4.738 4 4.998 4 5.517 4h12.966c.52 0 .78 0 .98.098a.97.97 0 0 1 .439.44c.098.2.098.46.098.979v12.966c0 .52 0 .78-.098.98a.96.96 0 0 1-.44.439c-.2.098-.46.098-.979.098H5.517c-.52 0-.78 0-.98-.098a.96.96 0 0 1-.439-.44C4 19.263 4 19.002 4 18.484z" />
      </G>
    </Svg>
  );
}

export function NetworkIcon({ networkId, size = 36 }: { networkId: string; size?: number }) {
  switch (networkId) {
    case 'ETH':     return <EthereumIcon size={size} />;
    case 'SOLANA':  return <SolanaIcon size={size} />;
    case 'POLYGON': return <PolygonIcon size={size} />;
    case 'BASE':    return <BaseIcon size={size} />;
    default:        return null;
  }
}
