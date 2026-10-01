export interface StateIdentity {
    directory: string;
    owner: string;
    profile?: string;
    home?: string;
}
export declare function resolveStateIdentity(profile: {
    name: string;
    dir: string;
    home: string;
} | undefined, entry: string, custom: string): StateIdentity;
/** Exclusive creation prevents two profiles from both adopting a custom directory. */
export declare function claimStateDirectory(identity: StateIdentity): Promise<void>;
/** Desktop adopts legacy metadata only; navigation stays disabled until Host reconciliation. */
export declare function importLegacyInbox(identity: StateIdentity): Promise<void>;
//# sourceMappingURL=state-identity.d.ts.map