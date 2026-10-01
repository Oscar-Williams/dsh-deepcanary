export interface PendingQuestionFact {
    callId: string;
    state: 'open' | 'continued';
}
export interface UserQuestionFacts {
    active: PendingQuestionFact[];
    settledCallIds: string[];
}
/** Consume only identities/state from the host projection; never inspect question/answer content. */
export declare function readUserQuestionFacts(registry: unknown, session: unknown, lastSeq: number | undefined): UserQuestionFacts | undefined;
//# sourceMappingURL=user-questions.d.ts.map