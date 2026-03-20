// ============================================================================
// events.rs — On-chain Events for PollDotSol Program
// ============================================================================
// Yeh file sare events define karti hai jo on-chain emit hote hain.
// Events ka use hota hai:
// 1. Frontend ko real-time updates dene ke liye (via websocket listeners)
// 2. Transaction logs me important actions record karne ke liye
// 3. Off-chain indexers (like Helius, Shyft) ko data feed karne ke liye
//
// Jab bhi koi important action hota hai (token create, buy, vote, etc.)
// toh hum ek event emit karte hain taaki frontend usse catch kar sake.
// ============================================================================

use anchor_lang::prelude::*;

// ============================================================================
// TOKEN RELATED EVENTS
// ============================================================================

/// Jab admin naya SPL token mint create karta hai tab yeh event emit hota hai.
/// Frontend isse use karke token mint address display kar sakta hai.
///
/// Example: Admin ne 6 decimals wala token create kiya
/// → TokenCreated { mint: "ABC...", decimals: 6 }
#[event]
pub struct TokenCreated {
    /// Naye token mint ka public key address
    pub mint: Pubkey,
    /// Token ke decimals (e.g., 6 means 1 token = 1_000_000 smallest units)
    pub decimals: u8,
}

/// Jab admin treasury account me tokens mint karta hai tab yeh emit hota hai.
///
/// Example: Admin ne 1000 tokens mint kiye
/// → TokensMinted { mint: "ABC...", amount: 1_000_000_000, destination: "TREASURY..." }
#[event]
pub struct TokensMinted {
    /// Kis token mint ke tokens mint hue
    pub mint: Pubkey,
    /// Kitne tokens mint hue (smallest unit me, decimals ke saath)
    pub amount: u64,
    /// Kis account me tokens gaye (usually treasury token account)
    pub destination: Pubkey,
}

// ============================================================================
// TREASURY RELATED EVENTS
// ============================================================================

/// Jab admin treasury ko initialize karta hai — treasury token account
/// aur SOL vault dono banate hain.
///
/// Example: Admin ne treasury initialize ki
/// → TreasuryInitialized { treasury: "TRES...", vault: "VAULT...", token_account: "TA..." }
#[event]
pub struct TreasuryInitialized {
    /// Treasury state account ka address
    pub treasury: Pubkey,
    /// SOL vault PDA ka address — yaha SOL store hota hai
    pub vault: Pubkey,
    /// Treasury ka token account — yaha tokens store hote hain
    pub token_account: Pubkey,
}

// ============================================================================
// PLATFORM SETTINGS EVENTS
// ============================================================================

/// Jab admin platform settings update karta hai (price, costs, fee).
///
/// Example: Price=0.1 SOL, proposal=10 tokens, vote=1 token, fee=10%
/// → PlatformSettingsUpdated { token_price: 100_000_000, proposal_cost: 10_000_000,
///                             vote_cost: 1_000_000, fee_basis_points: 1000 }
#[event]
pub struct PlatformSettingsUpdated {
    /// 1 token ka price lamports me (1 SOL = 1_000_000_000 lamports)
    pub token_price: u64,
    /// Proposal create karne ke liye kitne tokens chahiye (smallest unit me)
    pub proposal_cost: u64,
    /// Vote karne ke liye kitne tokens chahiye (smallest unit me)
    pub vote_cost: u64,
    /// Platform fee basis points me (1000 = 10%, 500 = 5%, 10000 = 100%)
    pub fee_basis_points: u16,
}

// ============================================================================
// TOKEN PURCHASE / REDEEM EVENTS
// ============================================================================

/// Jab user tokens buy karta hai SOL de kar.
///
/// Example: U1 ne 10 tokens kharide, 1 SOL cost + 0.1 SOL fee
/// → TokensPurchased { buyer: "U1...", amount: 10_000_000,
///                     sol_cost: 1_000_000_000, fee: 100_000_000 }
#[event]
pub struct TokensPurchased {
    /// Buyer ka wallet address
    pub buyer: Pubkey,
    /// Kitne tokens buy kiye (smallest unit me)
    pub amount: u64,
    /// SOL cost (excluding fee) lamports me
    pub sol_cost: u64,
    /// Platform fee lamports me
    pub fee: u64,
}

/// Jab user tokens redeem karta hai SOL wapas lene ke liye.
///
/// Example: U1 ne 10 tokens redeem kiye, 1 SOL mila minus 0.1 SOL fee
/// → TokensRedeemed { redeemer: "U1...", amount: 10_000_000,
///                    sol_received: 900_000_000, fee: 100_000_000 }
#[event]
pub struct TokensRedeemed {
    /// Redeemer ka wallet address
    pub redeemer: Pubkey,
    /// Kitne tokens redeem kiye (smallest unit me)
    pub amount: u64,
    /// Kitne SOL mila (fee minus karke) lamports me
    pub sol_received: u64,
    /// Platform fee lamports me
    pub fee: u64,
}

// ============================================================================
// PROPOSAL RELATED EVENTS
// ============================================================================

/// Jab user naya proposal create karta hai — tokens escrow me jaate hain.
///
/// Example: U1 ne "Best blockchain?" proposal banaya, 10 tokens escrow me gaye
/// → ProposalCreated { proposal: "PROP...", creator: "U1...",
///                     question: "Best blockchain?", deadline: 1234567890,
///                     escrow_amount: 10_000_000 }
#[event]
pub struct ProposalCreated {
    /// Proposal account ka address
    pub proposal: Pubkey,
    /// Proposal creator ka wallet address
    pub creator: Pubkey,
    /// Proposal ka question
    pub question: String,
    /// Deadline — Unix timestamp (seconds me)
    pub deadline: i64,
    /// Kitne tokens escrow me gaye
    pub escrow_amount: u64,
}

// ============================================================================
// VOTING RELATED EVENTS
// ============================================================================

/// Jab user kisi proposal pe vote karta hai — tokens voting escrow me jaate hain.
///
/// Example: U2 ne "Solana" pe vote kiya, 1 token escrow me gaya
/// → VoteCast { proposal: "PROP...", voter: "U2...",
///              option_index: 0, token_cost: 1_000_000 }
#[event]
pub struct VoteCast {
    /// Kis proposal pe vote hua
    pub proposal: Pubkey,
    /// Voter ka wallet address
    pub voter: Pubkey,
    /// Kis option pe vote diya (0-indexed)
    pub option_index: u8,
    /// Vote ke liye kitne tokens liye gaye (smallest unit me)
    pub token_cost: u64,
}

// ============================================================================
// FINALIZATION RELATED EVENTS
// ============================================================================

/// Jab proposal finalize hota hai — escrow release hota hai.
/// Proposal escrow → treasury, Voting escrow → creator
///
/// Example: Proposal finalized. 10 tokens treasury me gaye, 2 tokens creator ko mile.
/// → ProposalFinalized { proposal: "PROP...", creator: "U1...",
///                       proposal_escrow_returned: 10_000_000,
///                       voting_escrow_to_creator: 2_000_000,
///                       total_votes: 2 }
#[event]
pub struct ProposalFinalized {
    /// Finalized proposal ka address
    pub proposal: Pubkey,
    /// Proposal creator — jisko voting escrow ke tokens milenge
    pub creator: Pubkey,
    /// Kitne tokens proposal escrow se treasury me gaye
    pub proposal_escrow_returned: u64,
    /// Kitne tokens voting escrow se creator ko mile
    pub voting_escrow_to_creator: u64,
    /// Total kitne votes aaye the proposal pe
    pub total_votes: u64,
}

// ============================================================================
// METADATA EVENT
// ============================================================================

/// Jab admin token ka metadata (name, symbol, uri) set karta hai.
///
/// Example: Admin ne token ka name "PollToken", symbol "POLL" set kiya
/// → MetadataSet { mint: "ABC...", name: "PollToken", symbol: "POLL" }
#[event]
pub struct MetadataSet {
    /// Token mint ka address
    pub mint: Pubkey,
    /// Token ka name (e.g., "PollToken")
    pub name: String,
    /// Token ka symbol (e.g., "POLL")
    pub symbol: String,
}

// ============================================================================
// ADMIN WITHDRAWAL EVENT
// ============================================================================

/// Jab admin platform ke fees (SOL) vault se apne wallet me withdraw karta hai.
///
/// Example: Admin ne 1.5 SOL withdraw kiye
/// → FeesWithdrawn { admin: "ADMIN...", amount: 1_500_000_000 }
#[event]
pub struct FeesWithdrawn {
    /// Admin ka wallet address (jisne withdraw kiya)
    pub admin: Pubkey,
    /// Kitne lamports withdraw hue
    pub amount: u64,
}
