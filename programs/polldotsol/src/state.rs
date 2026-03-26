// ============================================================================
// state.rs — On-chain Account Data Structures for PollDotSol Program
// ============================================================================
// Yeh file sare on-chain data structures (accounts) define karti hai.
// Har account ek PDA (Program Derived Address) hota hai jo on-chain
// data store karta hai. Jab koi instruction execute hoti hai toh yeh
// accounts read/write hote hain.
//
// Anchor ka #[account] macro automatically:
// 1. 8 bytes ka discriminator add karta hai (account type identify karne ke liye)
// 2. Borsh serialization/deserialization implement karta hai
// 3. Account validation logic generate karta hai
//
// #[derive(InitSpace)] macro automatically space calculate karta hai!
// Dynamic types (String, Vec) ke liye #[max_len()] attribute use hota hai.
// Context me hum sirf `space = 8 + TypeName::INIT_SPACE` likhte hain
// (8 bytes discriminator ke liye + baaki Anchor calculate karta hai).
// ============================================================================

use anchor_lang::prelude::*;

// ============================================================================
// TREASURY STATE
// ============================================================================
// Treasury ek central account hai jo puri platform ko manage karta hai.
// Isme token mint, prices, fees, aur vault ki info stored hoti hai.
// Sirf admin hi treasury ko modify kar sakta hai.
//
// InitSpace macro automatically calculate karega:
// - admin (Pubkey): 32 bytes
// - mint (Pubkey): 32 bytes
// - treasury_token_account (Pubkey): 32 bytes
// - vault_bump (u8): 1 byte
// - token_price (u64): 8 bytes
// - proposal_cost (u64): 8 bytes
// - vote_cost (u64): 8 bytes
// - fee_basis_points (u16): 2 bytes
// - is_initialized (bool): 1 byte
// Anchor automatically sab add karega — hame manually kuch nahi karna!
// ============================================================================
#[account]
#[derive(InitSpace)] // ← Yeh macro automatically INIT_SPACE constant generate karta hai
pub struct Treasury {
    /// Admin ka wallet address — sirf yeh admin operations perform kar sakta hai.
    /// Jaise token create, mint, settings update, treasury initialize, etc.
    pub admin: Pubkey, // 32 bytes — Anchor jaanta hai Pubkey = 32 bytes

    /// SPL Token Mint ka address — yeh woh token hai jo puri platform pe use hota hai.
    /// Admin isse create karta hai (e.g., POLL token).
    pub mint: Pubkey, // 32 bytes

    /// Treasury ka token account — yaha pe tokens store hote hain.
    /// Jab admin mint karta hai → tokens yaha aate hain.
    /// Jab user buy karta hai → tokens yaha se jaate hain.
    /// Jab user redeem karta hai → tokens yaha wapas aate hain.
    pub treasury_token_account: Pubkey, // 32 bytes

    /// SOL Vault PDA ka bump seed — PDA derive karne ke liye use hota hai.
    /// PDA = Program Derived Address, ek special address jo program own karta hai.
    /// Bump stored karte hain taaki har baar recalculate na karna pade.
    pub vault_bump: u8, // 1 byte

    /// 1 token ka starting price lamports me (1 SOL = 1,000,000,000 lamports).
    /// Isse 'a' kehte hain bonding curve formula me: P(x) = a + b * x.
    pub base_price: u64, // 8 bytes

    /// Price growth rate lamports me.
    /// Har token sell hone pe price itna badh jaata hai.
    /// Isse 'b' kehte hain formula me.
    pub slope: u64, // 8 bytes

    /// Ab tak total kitne tokens sell ho chuke hain bonding curve se.
    /// Yeh 'x' hai formula me. Har buy pe badhta hai, sell pe kam hota hai.
    pub tokens_sold: u64, // 8 bytes

    /// Proposal create karne ke liye kitne tokens chahiye (smallest unit me).
    /// Example: agar proposal_cost = 10,000,000 aur decimals = 6
    /// toh 10 tokens chahiye proposal banane ke liye.
    /// Yeh tokens proposal escrow me lock ho jaate hain.
    pub proposal_cost: u64, // 8 bytes

    /// Vote karne ke liye kitne tokens chahiye (smallest unit me).
    /// Example: agar vote_cost = 1,000,000 aur decimals = 6
    /// toh 1 token chahiye vote karne ke liye.
    /// Yeh tokens voting escrow me lock ho jaate hain.
    pub vote_cost: u64, // 8 bytes

    /// Platform fee basis points me.
    /// 1 basis point = 0.01%, so:
    /// - 100 = 1%
    /// - 500 = 5%
    /// - 1000 = 10%
    /// - 10000 = 100%
    /// Yeh fee token buy aur redeem dono pe lagti hai.
    pub fee_basis_points: u16, // 2 bytes

    /// Kya treasury initialize hui hai ya nahi.
    /// Pehli baar initialize ke baad yeh true ho jaata hai.
    /// Dubara initialize karne se rokne ke liye use hota hai.
    pub is_initialized: bool, // 1 byte
}

// ============================================================================
// PROPOSAL STATE
// ============================================================================
// Proposal ek poll/question hai jisko koi bhi user create kar sakta hai.
// Creator ko proposal_cost tokens lock karne padte hain escrow me.
// Doosre users vote karte hain, aur deadline ke baad finalize hota hai.
//
// Dynamic fields ke liye #[max_len()] attribute use hota hai:
// - question: max 200 characters
// - options: max 10 items, har item max 50 characters
// - vote_counts: max 10 items (u64)
//
// InitSpace in sab ko automatically handle karta hai!
// ============================================================================
#[account]
#[derive(InitSpace)] // ← Automatic space calculation
pub struct Proposal {
    /// Proposal creator ka wallet address.
    /// Sirf creator hi proposal ko finalize kar sakta hai.
    /// Finalize ke baad voting escrow ke tokens creator ko milte hain.
    pub creator: Pubkey, // 32

    /// Proposal ka question — yeh woh sawaal hai jis pe log vote karte hain.
    /// Example: "Best blockchain?" ya "Solana ya Ethereum?"
    /// Max 200 characters allowed hai.
    ///
    /// #[max_len(200)] → InitSpace ko batata hai ki String max 200 bytes ho sakti hai.
    /// Anchor automatically 4 bytes length prefix + 200 bytes content = 204 bytes allocate karega.
    #[max_len(200)]
    pub question: String, // 4 (length prefix) + 200 (max content)

    /// Voting options ki list — yeh woh choices hain jinme se user ek choose karta hai.
    /// Example: ["Solana", "Ethereum", "Polygon"]
    /// Min 2, Max 10 options allowed.
    ///
    /// #[max_len(10, 50)] → Vec me max 10 items, har item max 50 bytes.
    /// Anchor calculate karega: 4 (vec length) + 10 * (4 + 50) = 544 bytes
    #[max_len(10, 50)]
    pub options: Vec<String>, // 4 + 10 * (4 + 50)

    /// Har option pe kitne votes aaye — index options ke index se match karta hai.
    /// Example: agar options = ["Solana", "Ethereum"] aur vote_counts = [5, 3]
    /// toh Solana ko 5 votes mile aur Ethereum ko 3.
    ///
    /// #[max_len(10)] → max 10 u64 values (har option ke liye ek).
    /// Anchor: 4 (vec length) + 10 * 8 = 84 bytes
    #[max_len(10)]
    pub vote_counts: Vec<u64>, // 4 + 10 * 8

    /// Total number of votes casted on this proposal.
    /// Yeh voting escrow me locked tokens ka indicator bhi hai.
    pub total_votes: u64, // 8

    /// Proposal ki deadline — Unix timestamp (seconds me).
    /// Iske baad vote nahi kar sakte, sirf finalize kar sakte hain.
    /// Example: current_time + 86400 (24 hours baad)
    pub deadline: i64, // 8

    /// Kya proposal finalize ho chuka hai ya nahi.
    /// Finalize ke baad na vote ho sakta hai na dubara finalize.
    pub is_finalized: bool, // 1

    /// Proposal Escrow Token Account ka address.
    /// Jab proposal create hota hai, proposal_cost tokens yaha lock hote hain.
    /// Finalize ke baad yeh tokens treasury me wapas jaate hain.
    pub proposal_escrow: Pubkey, // 32

    /// Voting Escrow Token Account ka address.
    /// Jab koi user vote karta hai, vote_cost tokens yaha lock hote hain.
    /// Finalize ke baad yeh tokens creator ko milte hain.
    pub voting_escrow: Pubkey, // 32

    /// Proposal escrow PDA ka bump seed.
    pub proposal_escrow_bump: u8, // 1

    /// Voting escrow PDA ka bump seed.
    pub voting_escrow_bump: u8, // 1

    /// Unique proposal ID — har proposal ka alag ID hota hai.
    /// Yeh PDA derive karne ke liye use hota hai.
    pub proposal_id: u64, // 8
}

// ============================================================================
// VOTE RECORD STATE
// ============================================================================
// VoteRecord track karta hai ki kaunsa user kiski proposal pe vote kar chuka hai.
// Yeh duplicate voting rokne ke liye use hota hai — ek user ek proposal pe
// sirf ek baar vote kar sakta hai.
// ============================================================================
#[account]
#[derive(InitSpace)] // ← Automatic space calculation
pub struct VoteRecord {
    /// Voter ka wallet address.
    pub voter: Pubkey, // 32

    /// Kis proposal pe vote kiya.
    pub proposal: Pubkey, // 32

    /// Kis option pe vote diya (0-indexed).
    /// Example: agar options = ["Solana", "Ethereum"] aur option_index = 0
    /// toh voter ne Solana pe vote kiya.
    pub option_index: u8, // 1
}

// ============================================================================
// PROPOSAL COUNTER STATE
// ============================================================================
// ProposalCounter ek global counter hai jo track karta hai ki ab tak
// kitne proposals create ho chuke hain. Har naye proposal ko unique ID
// dene ke liye use hota hai.
// ============================================================================
#[account]
#[derive(InitSpace)] // ← Automatic space calculation
pub struct ProposalCounter {
    /// Ab tak kitne proposals bane hain. Naye proposal ka ID = count + 1.
    /// Example: agar count = 5, toh next proposal ka ID = 6.
    pub count: u64, // 8
}

// ============================================================================
// GAME COUNTER STATE
// ============================================================================
// GameCounter track karta hai ki ab tak kitne games (Flip a Coin)
// create ho chuke hain taaki har naye game ko unique ID mile.
// ============================================================================
#[account]
#[derive(InitSpace)]
pub struct GameCounter {
    /// Total games created. Unique ID ke liye use hota hai.
    pub count: u64, // 8
}

// ============================================================================
// GAME POOL STATE
// ============================================================================
// GamePool 'Flip a Coin' game ka state store karta hai.
// Isme do players hote hain jo tokens bet karte hain.
// Ek player naya pool banata hai (Head/Tail choose karke)
// aur doosra join karta hai (opposite automatic milta hai).
// ============================================================================
#[account]
#[derive(InitSpace)]
pub struct GamePool {
    /// Game creator ka wallet address.
    pub creator: Pubkey, // 32

    /// Game joiner ka wallet address (None jab tak kisi ne join nahi kiya).
    pub opponent: Option<Pubkey>, // 1 + 32 = 33

    /// Har user kitne tokens stake karega (Bet amount).
    pub amount: u64, // 8

    /// Creator ne kya choose kiya (0: Head, 1: Tail).
    pub creator_choice: u8, // 1

    /// Coin flip ka final result (None jab tak resolved nahi, 0: Head, 1: Tail).
    pub result: Option<u8>, // 1 + 1 = 2

    /// Winner ka wallet address.
    pub winner: Option<Pubkey>, // 1 + 32 = 33

    /// Unique Game ID — PDA derive karne ke liye use hota hai.
    pub pool_id: u64, // 8

    /// Status: 0 = Open (Waiting for opponent), 1 = Resolved (Winner declared)
    pub status: u8, // 1

    /// PDA ka bump seed.
    pub bump: u8, // 1
}
