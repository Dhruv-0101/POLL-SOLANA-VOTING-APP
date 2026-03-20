// ============================================================================
// context.rs — Anchor Account Contexts for PollDotSol Program
// ============================================================================
// Yeh file sare account contexts define karti hai. Anchor me har instruction
// ke liye ek Context struct banate hain jo batata hai ki us instruction ko
// execute karne ke liye kaunse accounts chahiye, kaunse writable hain,
// kaunse signers hain, aur PDAs kaise derive hote hain.
//
// #[derive(Accounts)] macro Anchor ko batata hai ki yeh ek account
// validation struct hai. Anchor automatically:
// 1. Accounts ko deserialize karta hai
// 2. Ownership check karta hai
// 3. PDA validation karta hai
// 4. Constraints check karta hai (has_one, constraint, etc.)
// ============================================================================

use anchor_lang::prelude::*;
use anchor_spl::{
    // associated_token module — user ke liye automatically correct token account
    // derive karta hai based on (wallet_address, token_mint).
    associated_token::AssociatedToken,
    // metadata module — Token ke name, symbol, image URI set karne ke liye.
    metadata::Metadata as MetadataProgram,
    // token module — SPL Token program ke saath interact karne ke liye.
    // Mint = token definition, TokenAccount = token holding account.
    token::{Mint, Token, TokenAccount},
};

// Apne program ke state structs import karte hain
use crate::state::*;

// ============================================================================
// 1. CREATE TOKEN CONTEXT
// ============================================================================
// Admin ek naya SPL Token Mint create karta hai.
// Yeh token puri platform pe use hoga — buy, sell, vote, proposal sab me.
//
// Accounts needed:
// - admin: Signer + fee payer
// - mint: Naya token mint account (PDA based on "mint" + admin)
// - treasury: Treasury state account (PDA, first time init ho raha hai)
// - system_program: Account create karne ke liye
// - token_program: Mint create karne ke liye
// - rent: Rent exemption check ke liye
// ============================================================================
#[derive(Accounts)]
pub struct CreateToken<'info> {
    /// Admin ka wallet — yeh sign karega aur rent pay karega.
    /// `mut` kyunki SOL deduct hoga (account creation rent ke liye).
    #[account(mut)]
    pub admin: Signer<'info>,

    /// Naya token mint account — PDA se derive hota hai.
    /// Seeds: ["mint", admin.key()] — har admin ka ek unique mint hoga.
    ///
    /// `init` = naya account create karega
    /// `payer = admin` = admin rent pay karega
    /// `mint::decimals = 6` = 6 decimal places (1 token = 1,000,000 smallest units)
    /// `mint::authority = treasury` = treasury hi tokens mint kar sakti hai
    #[account(
        init,
        payer = admin,
        seeds = [b"mint", admin.key().as_ref()],
        bump,
        mint::decimals = 6,
        // Yaha par 'mint::authority' humne 'treasury' PDA ko di hai.
        // Iska matlab admin personally apne wallet se tokens mint nahi kar sakta.
        // Tokens sirf is smart contract ke through, program rules follow 
        // karke hi mint ho sakte hain. Ye security ke liye bahot zaroori hai.
        mint::authority = treasury,
    )]
    pub mint: Account<'info, Mint>,

    /// Treasury state account — platform ki sari configuration yaha store hoti hai.
    /// Pehli baar create hota hai (init_if_needed) — agar already exist kare toh
    /// reuse hota hai.
    ///
    /// Seeds: ["treasury", admin.key()] — har admin ki ek unique treasury.
    /// space = 8 + Treasury::INIT_SPACE
    /// 8 bytes = discriminator (Anchor har account me add karta hai)
    /// INIT_SPACE = #[derive(InitSpace)] macro se auto-calculate hota hai
    #[account(
        init_if_needed,
        payer = admin,
        seeds = [b"treasury", admin.key().as_ref()],
        bump,
        space = 8 + Treasury::INIT_SPACE,
    )]
    pub treasury: Account<'info, Treasury>,

    /// System Program — naye accounts create karne ke liye zaroori hai.
    /// Solana me har account create karne ke liye system program call hota hai.
    pub system_program: Program<'info, System>,

    /// SPL Token Program — mint operations ke liye zaroori hai.
    /// Yeh Solana ka official token program hai jo sare SPL token
    /// operations handle karta hai.
    pub token_program: Program<'info, Token>,

    /// Rent sysvar — account ko rent exempt banana ke liye check hota hai.
    /// Solana me har account ko minimum balance rakhna padta hai
    /// taaki woh delete na ho.
    pub rent: Sysvar<'info, Rent>,
}

// ============================================================================
// 2. INITIALIZE TREASURY CONTEXT
// ============================================================================
// Admin treasury ko initialize karta hai — treasury token account
// (jaha tokens store honge) aur SOL vault (jaha SOL store hoga) create hota hai.
//
// Yeh step token create ke BAAD hota hai kyunki mint ka address chahiye.
// ============================================================================
#[derive(Accounts)]
pub struct InitializeTreasury<'info> {
    /// Admin ka wallet — signer + payer.
    #[account(mut)]
    pub admin: Signer<'info>,

    /// Treasury state account — pehle se exist karna chahiye (CreateToken me bana tha).
    /// `has_one = admin` = check karta hai ki treasury.admin == admin.key()
    /// Matlab sirf original admin hi treasury initialize kar sakta hai.
    #[account(
        mut,
        seeds = [b"treasury", admin.key().as_ref()],
        bump,
        has_one = admin,
    )]
    pub treasury: Account<'info, Treasury>,

    /// Token Mint — pehle se exist karna chahiye (CreateToken me bana tha).
    /// Yeh verify karta hai ki sahi mint use ho raha hai.
    #[account(
        seeds = [b"mint", admin.key().as_ref()],
        bump,
    )]
    pub mint: Account<'info, Mint>,

    /// Treasury ka Token Account — yaha pe sare tokens store honge.
    /// `init` = naya create hoga
    /// `associated_token::mint = mint` = is mint ke tokens store karega
    /// `associated_token::authority = treasury` = treasury own karega
    ///
    /// Associated Token Account (ATA) Solana ka standard hai — har wallet
    /// ke liye har token ka ek deterministic address hota hai.
    #[account(
        init,
        payer = admin,
        associated_token::mint = mint,
        associated_token::authority = treasury,
    )]
    pub treasury_token_account: Account<'info, TokenAccount>,

    /// SOL Vault — ek PDA jo SOL store karta hai.
    /// Jab users tokens buy karte hain → SOL yaha aata hai.
    /// Jab users tokens redeem karte hain → SOL yaha se jaata hai.
    ///
    /// `seeds = ["vault", treasury.key()]` — treasury se linked hai.
    /// `init` = pehli baar create ho raha hai.
    /// `space = 0` = koi data store nahi karta, sirf SOL hold karta hai.
    ///
    /// NOTE: "space = 0" means sirf 8 bytes discriminator ke liye nahi hai,
    /// SystemAccount hai toh koi data nahi — sirf lamports hold karta hai.
    /// CHECK: This is a PDA used as a SOL vault, no data is stored.
    #[account(
        mut,
        seeds = [b"vault", treasury.key().as_ref()],
        bump,
    )]
    pub vault: SystemAccount<'info>,

    /// System Program — account creation ke liye.
    pub system_program: Program<'info, System>,
    /// Token Program — token account operations ke liye.
    pub token_program: Program<'info, Token>,
    /// Associated Token Program — ATA create karne ke liye.
    pub associated_token_program: Program<'info, AssociatedToken>,
}

// ============================================================================
// 3. SET TOKEN METADATA CONTEXT
// ============================================================================
// Admin token ka metadata set karta hai — name, symbol, image URI.
// Yeh Metaplex Token Metadata program use karta hai.
// ============================================================================
#[derive(Accounts)]
pub struct SetTokenMetadata<'info> {
    /// Admin ka wallet — signer + payer (metadata account ka rent pay karega).
    #[account(mut)]
    pub admin: Signer<'info>,

    /// Treasury — mint authority ke roop me sign karega (PDA signer).
    /// Treasury is mint ki authority hai, toh metadata set karne ke liye
    /// treasury ka signature chahiye.
    #[account(
        mut,
        seeds = [b"treasury", admin.key().as_ref()],
        bump,
        has_one = admin,
    )]
    pub treasury: Account<'info, Treasury>,

    /// Token Mint — jis token ka metadata set karna hai.
    #[account(
        mut,
        seeds = [b"mint", admin.key().as_ref()],
        bump,
    )]
    pub mint: Account<'info, Mint>,

    /// Metadata Account — Metaplex ka standard metadata account.
    /// Yeh UncheckedAccount hai kyunki Metaplex program isse validate karega.
    /// Seeds by Metaplex: ["metadata", token_metadata_program_id, mint_key]
    ///
    /// CHECK: This account is validated by the Metaplex Metadata program.
    /// We cannot use a typed account here because it's created by an external program.
    #[account(mut)]
    pub metadata_account: UncheckedAccount<'info>,

    /// System Program — CPI (Cross Program Invocation) ke liye.
    pub system_program: Program<'info, System>,
    /// Token Program
    pub token_program: Program<'info, Token>,
    /// Metaplex Token Metadata Program — metadata create karne ke liye.
    pub token_metadata_program: Program<'info, MetadataProgram>,
    /// Rent sysvar
    pub rent: Sysvar<'info, Rent>,
}

// ============================================================================
// 4. MINT TOKENS CONTEXT
// ============================================================================
// Admin treasury me tokens mint karta hai.
// Example: 1000 tokens mint → treasury_token_account me jaate hain.
// ============================================================================
#[derive(Accounts)]
pub struct MintTokens<'info> {
    /// Admin ka wallet — signer.
    #[account(mut)]
    pub admin: Signer<'info>,

    /// Treasury — mint authority confirm karne ke liye + has_one check.
    #[account(
        mut,
        seeds = [b"treasury", admin.key().as_ref()],
        bump,
        has_one = admin,
    )]
    pub treasury: Account<'info, Treasury>,

    /// Token Mint — jis token ke tokens mint karne hain.
    /// `mut` kyunki mint ke baad supply badhegi.
    #[account(
        mut,
        seeds = [b"mint", admin.key().as_ref()],
        bump,
    )]
    pub mint: Account<'info, Mint>,

    /// Treasury ka token account — mint ke tokens yaha jayenge.
    /// treasry_token_account → treasury ki authority ke andar.
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = treasury,
    )]
    pub treasury_token_account: Account<'info, TokenAccount>,

    /// Token Program — mint_to CPI ke liye.
    pub token_program: Program<'info, Token>,
}

// ============================================================================
// 5. UPDATE PLATFORM SETTINGS CONTEXT
// ============================================================================
// Admin platform ki settings update karta hai:
// - Token price (SOL me)
// - Proposal creation cost (tokens me)
// - Vote cost (tokens me)
// - Platform fee (basis points me)
// ============================================================================
#[derive(Accounts)]
pub struct UpdatePlatformSettings<'info> {
    /// Admin ka wallet — signer.
    #[account(mut)]
    pub admin: Signer<'info>,

    /// Treasury — settings yahi store hoti hain.
    /// `has_one = admin` = confirm karta hai ki sahi admin hai.
    #[account(
        mut,
        seeds = [b"treasury", admin.key().as_ref()],
        bump,
        has_one = admin,
    )]
    pub treasury: Account<'info, Treasury>,
}

// ============================================================================
// 6. BUY TOKENS CONTEXT
// ============================================================================
// User SOL de ke tokens buy karta hai.
// SOL → Vault me jaata hai
// Tokens → Treasury se user ke token account me jaate hain
// Fee → Platform fee bhi lagti hai
// ============================================================================
#[derive(Accounts)]
pub struct BuyTokens<'info> {
    /// User ka wallet — buyer. SOL iske wallet se deduct hoga.
    #[account(mut)]
    pub buyer: Signer<'info>,

    /// Treasury — price, fee, mint info stored hai yaha.
    #[account(
        mut,
        seeds = [b"treasury", treasury.admin.as_ref()],
        bump,
    )]
    pub treasury: Account<'info, Treasury>,

    /// Token Mint — kis token ke tokens buy karne hain.
    #[account(
        mut,
        seeds = [b"mint", treasury.admin.as_ref()],
        bump,
    )]
    pub mint: Account<'info, Mint>,

    /// Treasury ka token account — yaha se tokens user ko transfer honge.
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = treasury,
    )]
    pub treasury_token_account: Account<'info, TokenAccount>,

    /// User ka token account — yaha pe bought tokens aayenge.
    /// `init_if_needed` = agar user ka pehla purchase hai toh account create hoga.
    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = mint,
        associated_token::authority = buyer,
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,

    /// SOL Vault — user ka SOL yaha jaayega.
    /// CHECK: PDA used as SOL vault.
    #[account(
        mut,
        seeds = [b"vault", treasury.key().as_ref()],
        bump,
    )]
    pub vault: SystemAccount<'info>,

    /// System Program — SOL transfer ke liye.
    pub system_program: Program<'info, System>,
    /// Token Program — token transfer ke liye.
    pub token_program: Program<'info, Token>,
    /// Associated Token Program — ATA create karne ke liye (init_if_needed).
    pub associated_token_program: Program<'info, AssociatedToken>,
}

// ============================================================================
// 7. CREATE PROPOSAL CONTEXT
// ============================================================================
// User naya proposal create karta hai.
// Tokens user se → Proposal Escrow me lock hote hain.
// Proposal account, Escrow accounts sab create hote hain.
// ============================================================================
#[derive(Accounts)]
#[instruction(question: String, options: Vec<String>, deadline: i64)]
pub struct CreateProposal<'info> {
    /// Proposal creator ka wallet.
    #[account(mut)]
    pub creator: Signer<'info>,

    /// Treasury — proposal_cost, vote_cost, mint info ke liye.
    #[account(
        mut,
        seeds = [b"treasury", treasury.admin.as_ref()],
        bump,
    )]
    pub treasury: Account<'info, Treasury>,

    /// Token Mint.
    #[account(
        seeds = [b"mint", treasury.admin.as_ref()],
        bump,
    )]
    pub mint: Account<'info, Mint>,

    /// Proposal Counter — next proposal ID generate karne ke liye.
    /// `init_if_needed` = pehla proposal ho toh counter bhi create hoga.
    #[account(
        init_if_needed,
        payer = creator,
        seeds = [b"proposal_counter", treasury.key().as_ref()],
        bump,
        space = 8 + ProposalCounter::INIT_SPACE,
    )]
    pub proposal_counter: Account<'info, ProposalCounter>,

    /// Proposal Account — naya proposal data yaha store hoga.
    /// Seeds: ["proposal", treasury, proposal_id]
    /// proposal_id = counter.count (current count, jo abhi increment hoga)
    #[account(
        init,
        payer = creator,
        seeds = [b"proposal", treasury.key().as_ref(), proposal_counter.count.to_le_bytes().as_ref()],
        bump,
        space = 8 + Proposal::INIT_SPACE,
    )]
    pub proposal: Account<'info, Proposal>,

    /// Proposal Escrow Token Account — proposal_cost tokens yaha lock honge.
    /// Seeds: ["proposal_escrow", proposal.key()]
    /// Yeh ek PDA-owned token account hai.
    #[account(
        init,
        payer = creator,
        seeds = [b"proposal_escrow", proposal.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = proposal_escrow,
    )]
    pub proposal_escrow: Account<'info, TokenAccount>,

    /// Voting Escrow Token Account — vote tokens yaha lock honge.
    /// Seeds: ["voting_escrow", proposal.key()]
    #[account(
        init,
        payer = creator,
        seeds = [b"voting_escrow", proposal.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = voting_escrow,
    )]
    pub voting_escrow: Account<'info, TokenAccount>,

    /// Creator ka token account — yaha se tokens deduct honge.
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = creator,
    )]
    pub creator_token_account: Account<'info, TokenAccount>,

    /// System Program.
    pub system_program: Program<'info, System>,
    /// Token Program.
    pub token_program: Program<'info, Token>,
    /// Associated Token Program.
    pub associated_token_program: Program<'info, AssociatedToken>,
}

// ============================================================================
// 8. CAST VOTE CONTEXT
// ============================================================================
// User kisi proposal pe vote karta hai.
// Tokens user se → Voting Escrow me lock hote hain.
// VoteRecord create hota hai (duplicate vote rokne ke liye).
// ============================================================================
#[derive(Accounts)]
#[instruction(option_index: u8)]
pub struct CastVote<'info> {
    /// Voter ka wallet.
    #[account(mut)]
    pub voter: Signer<'info>,

    /// Treasury — vote_cost ke liye.
    #[account(
        seeds = [b"treasury", treasury.admin.as_ref()],
        bump,
    )]
    pub treasury: Account<'info, Treasury>,

    /// Token Mint.
    #[account(
        seeds = [b"mint", treasury.admin.as_ref()],
        bump,
    )]
    pub mint: Account<'info, Mint>,

    /// Proposal — jis pe vote karna hai.
    #[account(mut)]
    pub proposal: Account<'info, Proposal>,

    /// Vote Record — duplicate voting rokne ke liye.
    /// Seeds: ["vote_record", proposal.key(), voter.key()]
    /// Agar yeh account pehle se exist kare → matlab user already vote kar chuka hai.
    #[account(
        init,
        payer = voter,
        seeds = [b"vote_record", proposal.key().as_ref(), voter.key().as_ref()],
        bump,
        space = 8 + VoteRecord::INIT_SPACE,
    )]
    pub vote_record: Account<'info, VoteRecord>,

    /// Voter ka token account — yaha se tokens deduct honge.
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = voter,
    )]
    pub voter_token_account: Account<'info, TokenAccount>,

    /// Voting Escrow — yaha pe vote tokens lock honge.
    #[account(
        mut,
        seeds = [b"voting_escrow", proposal.key().as_ref()],
        bump,
    )]
    pub voting_escrow: Account<'info, TokenAccount>,

    /// System Program.
    pub system_program: Program<'info, System>,
    /// Token Program.
    pub token_program: Program<'info, Token>,
}

// ============================================================================
// 9. FINALIZE PROPOSAL CONTEXT
// ============================================================================
// Proposal creator finalize karta hai deadline ke baad.
// Proposal Escrow tokens → Treasury me wapas jaate hain.
// Voting Escrow tokens → Creator ko milte hain.
// ============================================================================
#[derive(Accounts)]
pub struct FinalizeProposal<'info> {
    /// Creator ka wallet — sirf creator finalize kar sakta hai.
    #[account(mut)]
    pub creator: Signer<'info>,

    /// Treasury.
    #[account(
        mut,
        seeds = [b"treasury", treasury.admin.as_ref()],
        bump,
    )]
    pub treasury: Account<'info, Treasury>,

    /// Token Mint.
    #[account(
        seeds = [b"mint", treasury.admin.as_ref()],
        bump,
    )]
    pub mint: Account<'info, Mint>,

    /// Proposal — finalize hone wala proposal.
    #[account(
        mut,
        has_one = creator,
    )]
    pub proposal: Account<'info, Proposal>,

    /// Proposal Escrow — isme locked tokens treasury ko ja rahe hain.
    #[account(
        mut,
        seeds = [b"proposal_escrow", proposal.key().as_ref()],
        bump,
    )]
    pub proposal_escrow: Account<'info, TokenAccount>,

    /// Voting Escrow — isme locked tokens creator ko ja rahe hain.
    #[account(
        mut,
        seeds = [b"voting_escrow", proposal.key().as_ref()],
        bump,
    )]
    pub voting_escrow: Account<'info, TokenAccount>,

    /// Treasury ka token account — proposal escrow ke tokens yaha jayenge.
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = treasury,
    )]
    pub treasury_token_account: Account<'info, TokenAccount>,

    /// Creator ka token account — voting escrow ke tokens yaha jayenge.
    #[account(
        init_if_needed,
        payer = creator,
        associated_token::mint = mint,
        associated_token::authority = creator,
    )]
    pub creator_token_account: Account<'info, TokenAccount>,

    /// System Program.
    pub system_program: Program<'info, System>,
    /// Token Program.
    pub token_program: Program<'info, Token>,
    /// Associated Token Program.
    pub associated_token_program: Program<'info, AssociatedToken>,
}

// ============================================================================
// 10. REDEEM TOKENS CONTEXT
// ============================================================================
// User tokens wapas de ke SOL lena chahta hai.
// Tokens → User se → Treasury token account me jaate hain.
// SOL → Vault se → User ke wallet me jaata hai (minus fee).
// ============================================================================
#[derive(Accounts)]
pub struct RedeemTokens<'info> {
    /// User ka wallet — redeemer.
    #[account(mut)]
    pub redeemer: Signer<'info>,

    /// Treasury.
    #[account(
        mut,
        seeds = [b"treasury", treasury.admin.as_ref()],
        bump,
    )]
    pub treasury: Account<'info, Treasury>,

    /// Token Mint.
    #[account(
        seeds = [b"mint", treasury.admin.as_ref()],
        bump,
    )]
    pub mint: Account<'info, Mint>,

    /// User ka token account — yaha se tokens deduct honge.
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = redeemer,
    )]
    pub redeemer_token_account: Account<'info, TokenAccount>,

    /// Treasury ka token account — tokens yaha deposit honge.
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = treasury,
    )]
    pub treasury_token_account: Account<'info, TokenAccount>,

    /// SOL Vault — yaha se SOL user ko jaayega.
    /// CHECK: PDA used as SOL vault.
    #[account(
        mut,
        seeds = [b"vault", treasury.key().as_ref()],
        bump,
    )]
    pub vault: SystemAccount<'info>,

    /// System Program — SOL transfer ke liye.
    pub system_program: Program<'info, System>,
    /// Token Program — token transfer ke liye.
    pub token_program: Program<'info, Token>,
}

// ============================================================================
// 11. WITHDRAW FEES CONTEXT (Admin Only)
// ============================================================================
// Admin platform ke SOL fees (vault se) apne wallet me withdraw karta hai.
// ============================================================================
#[derive(Accounts)]
pub struct WithdrawFees<'info> {
    /// Admin ka wallet — jaha SOL jaayega.
    #[account(mut)]
    pub admin: Signer<'info>,

    /// Treasury — admin verify karne ke liye.
    #[account(
        seeds = [b"treasury", admin.key().as_ref()],
        bump,
        has_one = admin,
    )]
    pub treasury: Account<'info, Treasury>,

    /// SOL Vault — yaha se SOL nikala jaayega.
    #[account(
        mut,
        seeds = [b"vault", treasury.key().as_ref()],
        bump,
    )]
    pub vault: SystemAccount<'info>,

    /// System Program.
    pub system_program: Program<'info, System>,
}
