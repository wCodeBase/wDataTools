export type Combine<A, B> = A & Omit<B, keyof A>;
