// ============================================================================
// errors.rs — Custom Error Codes for PollDotSol Program
// ============================================================================
// Yeh file sari custom errors define karti hai jo program me kahi bhi
// throw ho sakti hain. Har error ka ek unique code hota hai jo client
// side pe error identify karne me help karta hai.
// ============================================================================

use anchor_lang::prelude::*;

// ============================================================================
// #[error_code] macro se Anchor automatically har variant ko ek unique
// error code assign karta hai (starting from 6000). Jab bhi koi condition
// fail hoti hai, hum yeh errors return karte hain taaki client ko pata
// chale ki exactly kya galat hua.
// ============================================================================
#[error_code]
pub enum PollError {
    // =========================================================================
    // Treasury Related Errors
    // =========================================================================
    /// Treasury already initialized hai — dobara initialize nahi kar sakte.
    /// Yeh tab trigger hota hai jab admin treasury ko dubara initialize karne
    /// ki koshish kare jo pehle se exist karti hai.
    #[msg("Treasury has already been initialized")]
    TreasuryAlreadyInitialized,

    /// Treasury abhi initialize nahi hui hai — operations perform nahi kar sakte.
    /// Buy/redeem tokens ke liye pehle treasury initialize hona zaroori hai.
    #[msg("Treasury has not been initialized yet")]
    TreasuryNotInitialized,

    // =========================================================================
    // Token / Mint Related Errors
    // =========================================================================
    /// Token price zero ya negative nahi ho sakta.
    /// Admin ne platform settings me invalid price set ki.
    #[msg("Token price must be greater than zero")]
    InvalidTokenPrice,

    /// Mint amount zero nahi ho sakta — kam se kam 1 token mint karna hoga.
    #[msg("Mint amount must be greater than zero")]
    InvalidMintAmount,

    /// Token buy quantity zero nahi ho sakti.
    #[msg("Buy amount must be greater than zero")]
    InvalidBuyAmount,

    /// Redeem quantity zero nahi ho sakti.
    #[msg("Redeem amount must be greater than zero")]
    InvalidRedeemAmount,

    // =========================================================================
    // SOL / Balance Related Errors
    // =========================================================================
    /// User ke paas itne SOL nahi hain jitne required hain (cost + fee).
    #[msg("Insufficient SOL balance to complete the transaction")]
    InsufficientSolBalance,

    /// Treasury ke vault me itne SOL nahi hain redeem karne ke liye.
    /// Matlab vault me enough SOL deposited nahi hai.
    #[msg("Insufficient SOL in the vault for redemption")]
    InsufficientVaultBalance,

    /// User ke token account me enough tokens nahi hain.
    #[msg("Insufficient token balance")]
    InsufficientTokenBalance,

    // =========================================================================
    // Proposal Related Errors
    // =========================================================================
    /// Proposal me kam se kam 2 options hone chahiye warna voting ka
    /// koi matlab nahi banta.
    #[msg("Proposal must have at least 2 options")]
    TooFewOptions,

    /// Proposal me maximum 10 options allowed hain — UI aur storage
    /// limitations ki wajah se.
    #[msg("Proposal can have at most 10 options")]
    TooManyOptions,

    /// Proposal ka question empty nahi ho sakta — kuch toh likhna padega!
    #[msg("Proposal question cannot be empty")]
    EmptyQuestion,

    /// Proposal ka question bahut lamba hai — max 200 characters allowed.
    #[msg("Proposal question is too long (max 200 chars)")]
    QuestionTooLong,

    /// Option text empty nahi ho sakta.
    #[msg("Option text cannot be empty")]
    EmptyOption,

    /// Option text bahut lamba hai — max 50 characters allowed.
    #[msg("Option text is too long (max 50 chars)")]
    OptionTooLong,

    /// Deadline future me hona chahiye — past me proposal nahi bana sakte.
    #[msg("Deadline must be in the future")]
    DeadlineMustBeInFuture,

    /// User ke paas proposal create karne ke liye enough tokens nahi hain.
    /// Platform settings me defined proposal_cost se compare hota hai.
    #[msg("Not enough tokens to create a proposal")]
    NotEnoughTokensForProposal,

    // =========================================================================
    // Voting Related Errors
    // =========================================================================
    /// Invalid option index — matlab user ne aisa option select kiya
    /// jo proposal me exist hi nahi karta.
    #[msg("Invalid option index for voting")]
    InvalidOptionIndex,

    /// Proposal ki deadline khatam ho gayi — ab vote nahi kar sakte.
    #[msg("Proposal voting period has ended")]
    ProposalExpired,

    /// User pehle se is proposal pe vote kar chuka hai — dubara vote nahi
    /// kar sakta (1 vote per user per proposal).
    #[msg("You have already voted on this proposal")]
    AlreadyVoted,

    /// User ke paas voting ke liye enough tokens nahi hain.
    /// Platform settings me defined vote_cost se compare hota hai.
    #[msg("Not enough tokens to vote")]
    NotEnoughTokensForVote,

    /// Proposal already finalize ho chuka hai — ab vote nahi kar sakte.
    #[msg("Proposal has already been finalized")]
    ProposalAlreadyFinalized,

    // =========================================================================
    // Finalization Related Errors
    // =========================================================================
    /// Sirf proposal ka creator hi finalize kar sakta hai.
    #[msg("Only the proposal creator can finalize")]
    UnauthorizedFinalizer,

    /// Proposal ki deadline abhi khatam nahi hui — finalize karne ke liye
    /// deadline pass hona zaroori hai.
    #[msg("Proposal deadline has not passed yet")]
    ProposalNotExpired,

    // =========================================================================
    // Platform Settings Related Errors
    // =========================================================================
    /// Fee percentage 0-100 ke beech honi chahiye (basis points me).
    /// Example: 1000 = 10%, 500 = 5%
    #[msg("Fee percentage must be between 0 and 10000 (basis points)")]
    InvalidFeePercentage,

    /// Proposal cost zero nahi ho sakta.
    #[msg("Proposal cost must be greater than zero")]
    InvalidProposalCost,

    /// Vote cost zero nahi ho sakta.
    #[msg("Vote cost must be greater than zero")]
    InvalidVoteCost,

    // =========================================================================
    // Metadata Related Errors
    // =========================================================================
    /// Token name empty nahi ho sakta.
    #[msg("Token name cannot be empty")]
    EmptyTokenName,

    /// Token symbol empty nahi ho sakta.
    #[msg("Token symbol cannot be empty")]
    EmptyTokenSymbol,

    /// Token URI (image/metadata link) empty nahi ho sakta.
    #[msg("Token URI cannot be empty")]
    EmptyTokenUri,

    // =========================================================================
    // Math / Overflow Errors
    // =========================================================================
    /// Arithmetic operation me overflow ho gaya — numbers bahut bade ho gaye.
    #[msg("Arithmetic overflow occurred")]
    ArithmeticOverflow,

    /// Withdraw amount zero nahi ho sakta.
    #[msg("Withdraw amount must be greater than zero")]
    InvalidWithdrawAmount,
}
