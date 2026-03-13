import React from 'react';
import { OrkiConnect } from '../index';
export interface OrkiConnectModalProps {
    visible: boolean;
    onClose: () => void;
    bankAddress: string;
    sdk: OrkiConnect;
    onSuccess?: (txid: string) => void;
    onError?: (error: string) => void;
}
export declare function OrkiConnectModal({ visible, onClose, bankAddress, sdk, onSuccess, onError }: OrkiConnectModalProps): React.JSX.Element;
