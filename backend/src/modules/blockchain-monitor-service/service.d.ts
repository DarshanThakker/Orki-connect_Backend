/**
 * Starts blockchain monitoring for a session's deposit address.
 */
export declare function startMonitoring(session_id: string): Promise<void>;
/**
 * Stops monitoring for a session.
 */
export declare function stopMonitoring(session_id: string): void;
/**
 * Returns current count of active monitors.
 */
export declare function getActiveMonitorCount(): number;
//# sourceMappingURL=service.d.ts.map