import React from 'react';
import { OrkiConnect } from '../index';
export interface OrkiConnectModalProps {
    visible: boolean;
    onClose: () => void;
    bankAddress: string;
    sdk: OrkiConnect;
    onSuccess?: (txid: string) => void;
    onError?: (error: string) => void;
    hasAgreedBefore?: boolean;
    onAgreementAccepted?: () => void;
}
export declare function OrkiConnectModal({ visible, onClose, bankAddress, sdk, onSuccess, onError, hasAgreedBefore, onAgreementAccepted }: OrkiConnectModalProps): React.JSX.Element;
