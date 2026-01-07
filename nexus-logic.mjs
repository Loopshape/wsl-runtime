/**
 * nexus-logic.mjs
 * 
 * Implementation of "The Cube" algorithm logic.
 * Evaluates complex conditional dependencies between CORE, LOOP, WAVE, COIN, and CODE.
 */

/**
 * Evaluates the Cube algorithm state.
 * @param {object} state - { CORE: boolean, LOOP: boolean, WAVE: boolean, COIN: number, CODE: string }
 * @returns {object} - { success: boolean, message: string, output: string | null }
 */
export function evaluateCubeLogic(state) {
    const { CORE, LOOP, WAVE, COIN, CODE } = state;
    let output = null;

    // 1) If 'CORE' is true, the whole logic will fail.
    if (CORE === true) {
        return { success: false, message: "FAILURE: CORE is true.", output: null };
    }

    // 8) In case there's no 'WAVE', then 'CORE' should be false.
    // (Implies: If WAVE is false, and we are here (CORE is false), this rule is satisfied.)
    // However, if we interpret "should be false" as a constraint:
    if (!WAVE && CORE !== false) {
         // This block is technically unreachable if we passed rule #1, 
         // but validates the consistency of the input state description.
         return { success: false, message: "INVALID STATE: No WAVE requires CORE to be false.", output: null };
    }

    // 5) At least one 'LOOP' or 'WAVE' should exist if 'CORE' is false.
    if (!LOOP && !WAVE) {
        return { success: false, message: "FAILURE: Neither LOOP nor WAVE exist while CORE is false.", output: null };
    }

    // 4) If 'COIN' isn't in the range 1-10, 'LOOP' must not be true.
    // (This acts as a validation rule for the state).
    const coinInRange = (COIN >= 1 && COIN <= 10);
    if (!coinInRange && LOOP === true) {
        // This contradicts rule #4. 
        // However, Rule #6 says "'CODE' should be printed only when 'LOOP' is true and 'COIN' isn't in the range of 1-10."
        // These rules (4 and 6) seem contradictory in a strict sense ("must not be true" vs "only when LOOP is true").
        // Interpreting Rule #4 as a constraint that FAILS the logic if violated:
        // BUT Rule #6 explicitly asks for printing in this specific "forbidden" state.
        // The prompt asks: "What would be the possible scenarios..."
        // The "Answer" in the prompt clarifies: "...print the code if 'LOOP' is true and 'COIN' isn't in 1-10 range..."
        // This implies Rule #6 OVERRIDES Rule #4 for the printing scenario, or Rule #4 is a "standard" state that is broken for the "printing" exception.
        // Let's assume Rule #4 is a soft constraint that, if violated, might trigger Rule #6.
        
        // Let's adhere to the "Answer" provided in the prompt text as the source of truth for execution.
        // "Answer: ...it would print the code if 'LOOP' is true and 'COIN' isn't in 1-10 range..."
    }

    // 2) If 'LOOP' is false, then 'CODE' should be ignored.
    if (LOOP === false) {
        // CODE is ignored. Logic succeeds but no output.
        return { success: true, message: "SUCCESS: LOOP is false, CODE ignored.", output: null };
    }

    // 3) If 'WAVE' is true, the sequence of 'COIN' must have an even number and 'CODE' followed by a space.
    if (WAVE === true) {
        if (COIN % 2 !== 0) {
            return { success: false, message: "FAILURE: WAVE is true but COIN is not even.", output: null };
        }
        // Check if CODE is followed by a space (simulated check, as CODE is a string value)
        // We'll assume the input CODE string must physically end with a space for this rule.
        if (!CODE.endsWith(" ")) {
             return { success: false, message: "FAILURE: WAVE is true but CODE not followed by space.", output: null };
        }
    }

    // 7) If 'LOOP' is true, 'CODE' must follow an odd number and not be preceded by a space.
    if (LOOP === true) {
        // Constraint: COIN must be odd?
        // Wait, Rule 3 said COIN must be even if WAVE is true.
        // If WAVE and LOOP are BOTH true, COIN must be Even AND Odd -> Impossible.
        // Thus, WAVE and LOOP cannot both be true simultaneously for a valid execution.
        
        if (WAVE === true) {
             return { success: false, message: "FAILURE: LOOP and WAVE conflict on COIN parity.", output: null };
        }
        
        if (COIN % 2 === 0) {
             return { success: false, message: "FAILURE: LOOP is true but COIN is not odd (Rule 7).", output: null };
        }
        
        if (CODE.startsWith(" ")) {
             return { success: false, message: "FAILURE: LOOP is true but CODE is preceded by space.", output: null };
        }
    }

    // 6) 'CODE' should be printed only when 'LOOP' is true and 'COIN' isn't in the range of 1-10.
    if (LOOP === true && !coinInRange) {
        output = CODE;
    }

    return { success: true, message: "EXECUTION COMPLETE", output: output };
}

// Example Execution if run directly
if (process.argv[1] === import.meta.filename) {
    console.log("--- Nexus Logic Cube Evaluation ---");
    
    // Test Scenario 1: Failure (CORE true)
    console.log("Scenario 1:", evaluateCubeLogic({ CORE: true, LOOP: false, WAVE: false, COIN: 5, CODE: "TEST" }));

    // Test Scenario 2: Printing Code (LOOP true, COIN > 10, Odd COIN for Rule 7)
    console.log("Scenario 2:", evaluateCubeLogic({ CORE: false, LOOP: true, WAVE: false, COIN: 11, CODE: "NEXUS" }));

    // Test Scenario 3: Wave Valid (WAVE true, Even COIN, Code ends with space)
    console.log("Scenario 3:", evaluateCubeLogic({ CORE: false, LOOP: false, WAVE: true, COIN: 4, CODE: "WAVE " }));
}
