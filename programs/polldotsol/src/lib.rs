// ============================================================================
// lib.rs — Main Program Entry Point for PollDotSol
// ============================================================================
// Yeh file program ki sari instructions (functions) define karti hai.
// Anchor me #[program] module ke andar sari public functions define hoti hain
// jo clients (frontend/tests) call kar sakte hain.
//
// HAR instruction ka flow:
// 1. Client instruction call karta hai required accounts ke saath
// 2. Anchor accounts validate karta hai (context.rs ke rules ke mutabik)
// 3. Instruction function execute hoti hai (yaha pe business logic hai)
// 4. Event emit hota hai (events.rs)
// 5. Result return hota hai
//
// Module Structure:
// - errors.rs → Custom error codes
// - events.rs → On-chain events
// - state.rs → Account data structures
// - context.rs → Account validation contexts
// - lib.rs → Instructions (yeh file)
// ============================================================================

use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::metadata::mpl_token_metadata::instructions as mpl_instructions;
use anchor_spl::token;

// ============================================================================
// Module declarations — Anchor ko batate hain ki yeh files exist karti hain
// aur inke contents use karne hain.
// ============================================================================
pub mod context;
pub mod errors; // Custom errors import
pub mod events; // Events import
pub mod state; // State/account structs import // Account contexts import

// ============================================================================
// Use statements — modules se specific items import karte hain
// taaki har jagah full path na likhna pade.
// ============================================================================
use context::*;
use errors::PollError; // Errors short name se access ke liye
use events::*; // Sare events import (* = sab kuch) // Sare contexts import

// ============================================================================
// Program ID — yeh tumhara deployed program ka unique address hai.
// `anchor init` ke time generate hota hai.
// Har program ka ek unique ID hota hai Solana pe.
// ============================================================================
declare_id!("GofaqNwMJYvCJHVvPhf9ndRnmxsKSScjQQjRLCvR5oes");

// ============================================================================
// #[program] MACRO
// ============================================================================
// Yeh macro Anchor ko batata hai ki is module ke andar sari on-chain
// instructions hain. Anchor automatically:
// 1. Instruction discriminator generate karta hai (8 bytes hash)
// 2. Account deserialization handle karta hai
// 3. CPI (Cross Program Invocation) helpers generate karta hai
// ============================================================================
#[program]
pub mod polldotsol {
    use super::*;

    // ========================================================================
    // INSTRUCTION 1: CREATE TOKEN (Admin Only)
    // ========================================================================
    // Admin ek naya SPL Token Mint create karta hai.
    //
    // Flow:
    // 1. Admin "Create Token" button click karta hai (frontend se)
    // 2. Anchor naya Mint account create karta hai (PDA)
    // 3. Treasury state me mint address save hota hai
    // 4. Treasury me admin address bhi save hota hai
    // 5. TokenCreated event emit hota hai
    //
    // Parameters:
    // - ctx: CreateToken context (context.rs me defined hai)
    // - decimals: Token ke decimal places (usually 6)
    //
    // Example:
    //   Admin calls create_token(6)
    //   → Mint created at PDA ["mint", admin_pubkey]
    //   → Treasury initialized with admin = caller, mint = new_mint
    // ========================================================================
    pub fn create_token(ctx: Context<CreateToken>, decimals: u8) -> Result<()> {
        // -------------------------------------------------------------------
        // Treasury state account ka mutable reference lete hain.
        // `&mut` kyunki hume iske fields update karne hain.
        // -------------------------------------------------------------------
        let treasury = &mut ctx.accounts.treasury;

        // -------------------------------------------------------------------
        // Admin ka public key store karte hain treasury me.
        // Yeh future me has_one = admin check ke liye use hoga.
        // ctx.accounts.admin.key() → caller ka wallet address return karta hai.
        // -------------------------------------------------------------------
        treasury.admin = ctx.accounts.admin.key();

        // -------------------------------------------------------------------
        // Naye mint ka address treasury me save karte hain.
        // Yeh baad me token operations (mint, transfer) me use hoga.
        // ctx.accounts.mint.key() → newly created mint ka address.
        // -------------------------------------------------------------------
        treasury.mint = ctx.accounts.mint.key();

        // -------------------------------------------------------------------
        // TokenCreated event emit karte hain — frontend isse catch karega.
        // emit! macro Anchor ka hai jo event ko transaction logs me likhta hai.
        // -------------------------------------------------------------------
        emit!(TokenCreated {
            mint: ctx.accounts.mint.key(), // Mint ka address
            decimals,                      // Kitne decimal places
        });

        // -------------------------------------------------------------------
        // Ok(()) = instruction successfully complete hui, koi error nahi.
        // Rust me Result<()> return karte hain — Ok ya Err.
        // -------------------------------------------------------------------
        Ok(())
    }

    // ========================================================================
    // INSTRUCTION 2: INITIALIZE TREASURY (Admin Only)
    // ========================================================================
    // Admin treasury ko fully initialize karta hai — token account aur
    // SOL vault set up hota hai.
    //
    // Flow:
    // 1. Check: Kya treasury pehle se initialized hai? (Agar haan → error)
    // 2. Treasury token account ka address save karna
    // 3. Vault ka bump save karna (future PDA signing ke liye)
    // 4. is_initialized = true set karna
    // 5. TreasuryInitialized event emit karna
    //
    // Example:
    //   Admin calls initialize_treasury()
    //   → Treasury Token Account created (ATA)
    //   → SOL Vault PDA confirmed
    //   → treasury.is_initialized = true
    // ========================================================================
    pub fn initialize_treasury(
        ctx: Context<InitializeTreasury>,
        base_price: u64,
        slope: u64,
    ) -> Result<()> {
        let treasury = &mut ctx.accounts.treasury;

        // -------------------------------------------------------------------
        // Check: Agar treasury pehle se initialized hai toh error throw karo.
        // -------------------------------------------------------------------
        require!(
            !treasury.is_initialized,
            PollError::TreasuryAlreadyInitialized
        );

        // -------------------------------------------------------------------
        // Bonding Curve initial values set karte hain.
        // base_price ('a') aur slope ('b') ek baar set honge.
        // -------------------------------------------------------------------
        require!(base_price > 0, PollError::InvalidTokenPrice);
        treasury.base_price = base_price;
        treasury.slope = slope;
        treasury.tokens_sold = 0; // Starts from zero

        // -------------------------------------------------------------------
        // Treasury token account ka address save karte hain.
        // -------------------------------------------------------------------
        treasury.treasury_token_account = ctx.accounts.treasury_token_account.key();

        // -------------------------------------------------------------------
        // Vault ka bump seed save karte hain.
        // -------------------------------------------------------------------
        treasury.vault_bump = ctx.bumps.vault;

        // -------------------------------------------------------------------
        // Treasury ko initialized mark karte hain.
        // -------------------------------------------------------------------
        treasury.is_initialized = true;

        // -------------------------------------------------------------------
        // TreasuryInitialized event emit karte hain.
        // -------------------------------------------------------------------
        emit!(TreasuryInitialized {
            treasury: treasury.key(),
            vault: ctx.accounts.vault.key(),
            token_account: ctx.accounts.treasury_token_account.key(),
        });

        Ok(())
    }

    // ========================================================================
    // INSTRUCTION 3: SET TOKEN METADATA (Admin Only)
    // ========================================================================
    // Admin token ka name, symbol, aur image URI set karta hai.
    // Yeh Metaplex Token Metadata program ke through hota hai (CPI).
    //
    // CPI = Cross Program Invocation
    // Matlab hum apne program se doosre program (Metaplex) ko call karte hain.
    //
    // Flow:
    // 1. Metadata arguments prepare karo (name, symbol, uri)
    // 2. CPI accounts prepare karo
    // 3. Treasury PDA ke seeds se signer seeds banao
    // 4. Metaplex CreateMetadataAccountV3 instruction invoke karo
    // 5. MetadataSet event emit karo
    //
    // Example:
    //   Admin calls set_token_metadata("PollToken", "POLL", "https://example.com/logo.png")
    //   → Metaplex metadata account created
    //   → Token ab wallets me "POLL" symbol ke saath dikhega
    // ========================================================================
    pub fn set_token_metadata(
        ctx: Context<SetTokenMetadata>,
        name: String,
        symbol: String,
    ) -> Result<()> {
        // -------------------------------------------------------------------
        // Input validation — empty strings allowed nahi hain.
        // -------------------------------------------------------------------
        require!(!name.is_empty(), PollError::EmptyTokenName);
        require!(!symbol.is_empty(), PollError::EmptyTokenSymbol);

        // -------------------------------------------------------------------
        // Metaplex ko empty URI bhejte hain (since image nahi chahiye).
        // -------------------------------------------------------------------
        let uri = "".to_string();

        // -------------------------------------------------------------------
        // Treasury PDA ke signer seeds prepare karte hain.
        // Kyunki treasury mint ki authority hai, toh metadata set karne ke
        // liye treasury ko "sign" karna padega.
        //
        // PDA signing me seeds + bump chahiye:
        // seeds = ["treasury", admin_pubkey]
        // bump = jo Anchor ne find kiya (ctx.bumps.treasury)
        //
        // &[&[...]] format Anchor ka standard hai PDA signing ke liye.
        // Inner slice = seeds, Outer slice = multiple signers support karta hai.
        // -------------------------------------------------------------------
        let admin_key = ctx.accounts.admin.key();
        let treasury_bump = ctx.bumps.treasury;
        let signer_seeds: &[&[&[u8]]] = &[&[b"treasury", admin_key.as_ref(), &[treasury_bump]]];

        // -------------------------------------------------------------------
        // Metaplex CreateMetadataAccountV3 instruction build karte hain.
        //
        // Yeh Metaplex ka instruction builder hai jo batata hai:
        // - metadata: Metadata account ka address (jaha data store hoga)
        // - mint: Kis token ka metadata hai
        // - mint_authority: Kon authorize karta hai (treasury PDA)
        // - payer: Kon rent pay karega (admin)
        // - update_authority: Kon baad me update kar sakta hai
        // - system_program: Account creation ke liye
        // - rent: Rent exemption check
        // -------------------------------------------------------------------
        let create_metadata_ix = mpl_instructions::CreateMetadataAccountV3 {
            metadata: ctx.accounts.metadata_account.key(),
            mint: ctx.accounts.mint.key(),
            mint_authority: ctx.accounts.treasury.key(),
            payer: ctx.accounts.admin.key(),
            update_authority: (ctx.accounts.treasury.key(), true),
            system_program: ctx.accounts.system_program.key(),
            rent: Some(ctx.accounts.rent.key()),
        };

        // -------------------------------------------------------------------
        // Metadata arguments prepare karte hain.
        //
        // DataV2 struct me token ka actual data hota hai:
        // - name: Token ka display name (e.g., "PollToken")
        // - symbol: Token ka short symbol (e.g., "POLL")
        // - uri: Image/metadata JSON ka link
        // - seller_fee_basis_points: NFT secondary sale fee (tokens ke liye 0)
        // - creators: NFT creators list (tokens ke liye None)
        // - collection: NFT collection (tokens ke liye None)
        // - uses: NFT use tracking (tokens ke liye None)
        // -------------------------------------------------------------------
        let data = anchor_spl::metadata::mpl_token_metadata::types::DataV2 {
            name: name.clone(),
            symbol: symbol.clone(),
            uri,
            seller_fee_basis_points: 0,
            creators: None,
            collection: None,
            uses: None,
        };

        // -------------------------------------------------------------------
        // Instruction arguments prepare karte hain.
        // is_mutable: true = baad me metadata update bhi ho sakta hai
        // collection_details: None = yeh NFT collection nahi hai
        // -------------------------------------------------------------------
        let args = mpl_instructions::CreateMetadataAccountV3InstructionArgs {
            data,
            is_mutable: true,
            collection_details: None,
        };

        // -------------------------------------------------------------------
        // CPI execute karte hain — Metaplex program ko call karte hain.
        //
        // instruction() → Solana instruction format me convert karta hai
        // invoke_signed() → PDA signer ke saath instruction execute karta hai
        //
        // Normal invoke() = wallet signer ke liye
        // invoke_signed() = PDA signer ke liye (seeds se sign hota hai)
        //
        // Account infos = actual account references jo Solana runtime ko chahiye
        // -------------------------------------------------------------------
        let instruction = create_metadata_ix.instruction(args);

        anchor_lang::solana_program::program::invoke_signed(
            &instruction,
            &[
                ctx.accounts.metadata_account.to_account_info(),
                ctx.accounts.mint.to_account_info(),
                ctx.accounts.treasury.to_account_info(), // mint_authority
                ctx.accounts.admin.to_account_info(),    // payer
                ctx.accounts.treasury.to_account_info(), // update_authority
                ctx.accounts.system_program.to_account_info(),
                ctx.accounts.rent.to_account_info(),
            ],
            signer_seeds,
        )?;

        // -------------------------------------------------------------------
        // MetadataSet event emit karte hain.
        // -------------------------------------------------------------------
        emit!(MetadataSet {
            mint: ctx.accounts.mint.key(),
            name,
            symbol,
        });

        Ok(())
    }

    // ========================================================================
    // INSTRUCTION 4: MINT TOKENS (Admin Only)
    // ========================================================================
    // Admin treasury ke token account me tokens mint karta hai.
    //
    // Flow:
    // 1. Validate: amount > 0
    // 2. Treasury ke token account me tokens mint karo (CPI to SPL Token)
    // 3. TokensMinted event emit karo
    //
    // Example:
    //   Admin calls mint_tokens(1000)
    //   → 1000 * 10^6 = 1,000,000,000 smallest units mint honge
    //   Wait... actually amount already smallest units me pass hoga?
    //   Nahi — hum frontend se human-readable amount bhejenge aur
    //   yaha pe decimals se multiply karenge.
    //
    //   Actually, simplicity ke liye amount raw smallest units me pass hoga.
    //   Frontend calculate karega: user_input * 10^6
    // ========================================================================
    pub fn mint_tokens(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
        // -------------------------------------------------------------------
        // Validate: 0 tokens mint karne ka koi matlab nahi.
        // -------------------------------------------------------------------
        require!(amount > 0, PollError::InvalidMintAmount);

        // -------------------------------------------------------------------
        // Treasury PDA ke signer seeds — kyunki treasury mint ki authority hai.
        // Token mint karne ke liye authority ka signature chahiye.
        // -------------------------------------------------------------------
        let admin_key = ctx.accounts.admin.key();
        let treasury_bump = ctx.bumps.treasury;
        let signer_seeds: &[&[&[u8]]] = &[&[b"treasury", admin_key.as_ref(), &[treasury_bump]]];

        // -------------------------------------------------------------------
        // SPL Token Program ko CPI karte hain — MintTo instruction.
        //
        // token::mint_to() Anchor ka helper function hai jo:
        // 1. MintTo instruction banaata hai
        // 2. Specified accounts ke saath execute karta hai
        //
        // CpiContext::new_with_signer():
        // - new_with_signer kyunki PDA (treasury) sign kar raha hai
        // - token_program = SPL Token program ka reference
        // - MintTo struct = required accounts
        // - signer_seeds = PDA ke seeds
        //
        // token::MintTo struct me:
        // - mint: Kis mint se tokens banane hain
        // - to: Kaha pe tokens jaayenge (treasury_token_account)
        // - authority: Kon authorize kar raha hai (treasury PDA)
        // -------------------------------------------------------------------
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.treasury_token_account.to_account_info(),
                    authority: ctx.accounts.treasury.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;

        // -------------------------------------------------------------------
        // TokensMinted event emit karte hain.
        // -------------------------------------------------------------------
        emit!(TokensMinted {
            mint: ctx.accounts.mint.key(),
            amount,
            destination: ctx.accounts.treasury_token_account.key(),
        });

        Ok(())
    }

    // ========================================================================
    // INSTRUCTION 5: UPDATE PLATFORM SETTINGS (Admin Only)
    // ========================================================================
    // Admin platform settings update karta hai:
    // - token_price: 1 token ki price SOL me (lamports me)
    // - proposal_cost: Proposal create karne ke tokens (smallest units)
    // - vote_cost: Vote karne ke tokens (smallest units)
    // - fee_basis_points: Platform fee (1000 = 10%)
    //
    // Example:
    //   Admin calls update_platform_settings(
    //     token_price: 100_000_000,    // 0.1 SOL per token
    //     proposal_cost: 10_000_000,   // 10 tokens
    //     vote_cost: 1_000_000,        // 1 token
    //     fee_basis_points: 1000       // 10% fee
    //   )
    // ========================================================================
    pub fn update_platform_settings(
        ctx: Context<UpdatePlatformSettings>,
        base_price: u64,
        slope: u64,
        proposal_cost: u64,
        vote_cost: u64,
        fee_basis_points: u16,
    ) -> Result<()> {
        // -------------------------------------------------------------------
        // Sab values validate karte hain — 0 ya invalid nahi honi chahiye.
        // -------------------------------------------------------------------
        require!(base_price > 0, PollError::InvalidTokenPrice);
        require!(proposal_cost > 0, PollError::InvalidProposalCost);
        require!(vote_cost > 0, PollError::InvalidVoteCost);
        require!(fee_basis_points <= 10000, PollError::InvalidFeePercentage);

        // -------------------------------------------------------------------
        // Treasury me values update karte hain.
        // -------------------------------------------------------------------
        let treasury = &mut ctx.accounts.treasury;
        treasury.base_price = base_price;
        treasury.slope = slope;
        treasury.proposal_cost = proposal_cost;
        treasury.vote_cost = vote_cost;
        treasury.fee_basis_points = fee_basis_points;

        // -------------------------------------------------------------------
        // PlatformSettingsUpdated event emit karte hain.
        // -------------------------------------------------------------------
        emit!(PlatformSettingsUpdated {
            base_price,
            slope,
            proposal_cost,
            vote_cost,
            fee_basis_points,
        });

        Ok(())
    }

    // ========================================================================
    // INSTRUCTION 6: BUY TOKENS (User)
    // ========================================================================
    // User SOL de ke tokens buy karta hai.
    //
    // Flow:
    // 1. Calculate: total_sol_cost = amount * token_price
    // 2. Calculate: fee = total_sol_cost * fee_basis_points / 10000
    // 3. Calculate: total = total_sol_cost + fee
    // 4. Transfer SOL: User → Vault (total amount)
    // 5. Transfer Tokens: Treasury → User
    // 6. TokensPurchased event emit karo
    //
    // Example:
    //   token_price = 100_000_000 (0.1 SOL per token)
    //   amount = 10_000_000 (10 tokens in smallest units)
    //   fee_basis_points = 1000 (10%)
    //
    //   total_sol_cost = 10_000_000 * 100_000_000 / 1_000_000 = 1_000_000_000 (1 SOL)
    //   fee = 1_000_000_000 * 1000 / 10000 = 100_000_000 (0.1 SOL)
    //   total = 1_100_000_000 (1.1 SOL)
    //
    //   User pays 1.1 SOL → gets 10 tokens
    // ========================================================================
    pub fn buy_tokens(ctx: Context<BuyTokens>, amount: u64, max_cost: u64) -> Result<()> {
        // -------------------------------------------------------------------
        // Validate: 0 tokens buy karne ka koi matlab nahi.
        // -------------------------------------------------------------------
        require!(amount > 0, PollError::InvalidBuyAmount);

        let treasury = &mut ctx.accounts.treasury;

        // -------------------------------------------------------------------
        // Check: Treasury initialized hona chahiye.
        // -------------------------------------------------------------------
        require!(treasury.is_initialized, PollError::TreasuryNotInitialized);

        let mut total_sol_cost_u128: u128 = 0;
        let decimals: u64 = 1_000_000;
        let mut remaining_amount = amount;
        let mut current_x = treasury.tokens_sold;

        // Har whole token boundary pe price badhta hai.
        // Yeh loop efficient hai kyunki yeh full tokens ko batches me treat karta hai.
        while remaining_amount > 0 {
            let next_boundary = (current_x / decimals + 1) * decimals;
            let tokens_to_boundary = next_boundary
                .checked_sub(current_x)
                .ok_or(PollError::ArithmeticOverflow)?;

            let batch_size = std::cmp::min(remaining_amount, tokens_to_boundary);

            let x_whole = current_x / decimals;
            let price_per_full_token = (treasury.base_price as u128)
                .checked_add(
                    (treasury.slope as u128)
                        .checked_mul(x_whole as u128)
                        .ok_or(PollError::ArithmeticOverflow)?,
                )
                .ok_or(PollError::ArithmeticOverflow)?;

            let batch_cost = price_per_full_token
                .checked_mul(batch_size as u128)
                .ok_or(PollError::ArithmeticOverflow)?
                .checked_div(decimals as u128)
                .ok_or(PollError::ArithmeticOverflow)?;

            total_sol_cost_u128 = total_sol_cost_u128
                .checked_add(batch_cost)
                .ok_or(PollError::ArithmeticOverflow)?;

            remaining_amount -= batch_size;
            current_x += batch_size;
        }

        let total_sol_cost = total_sol_cost_u128 as u64;

        // -------------------------------------------------------------------
        // Fee calculate karte hain.
        // -------------------------------------------------------------------
        let fee = (total_sol_cost as u128)
            .checked_mul(treasury.fee_basis_points as u128)
            .ok_or(PollError::ArithmeticOverflow)?
            .checked_div(10000)
            .ok_or(PollError::ArithmeticOverflow)? as u64;

        // -------------------------------------------------------------------
        // Total payment = cost + fee
        // -------------------------------------------------------------------
        let total_payment = total_sol_cost
            .checked_add(fee)
            .ok_or(PollError::ArithmeticOverflow)?;

        // -------------------------------------------------------------------
        // Slippage Protection: Reject if total_payment > max_cost
        // -------------------------------------------------------------------
        require!(total_payment <= max_cost, PollError::SlippageExceeded);

        // -------------------------------------------------------------------
        // Check: User ke paas enough SOL hai?
        // -------------------------------------------------------------------
        require!(
            ctx.accounts.buyer.lamports() >= total_payment,
            PollError::InsufficientSolBalance
        );

        // -------------------------------------------------------------------
        // Check: Treasury me enough tokens hain?
        // -------------------------------------------------------------------
        require!(
            ctx.accounts.treasury_token_account.amount >= amount,
            PollError::InsufficientTokenBalance
        );

        // -------------------------------------------------------------------
        // Step 1: SOL transfer — User → Vault
        // -------------------------------------------------------------------
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            total_payment,
        )?;

        // -------------------------------------------------------------------
        // Step 2: Token transfer — Treasury → User
        // -------------------------------------------------------------------
        let admin_key = treasury.admin;
        let treasury_bump = ctx.bumps.treasury;
        let signer_seeds: &[&[&[u8]]] = &[&[b"treasury", admin_key.as_ref(), &[treasury_bump]]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.treasury_token_account.to_account_info(),
                    to: ctx.accounts.buyer_token_account.to_account_info(),
                    authority: treasury.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;

        // -------------------------------------------------------------------
        // Update on-chain state: tokens_sold badh jaata hai
        // -------------------------------------------------------------------
        treasury.tokens_sold = treasury
            .tokens_sold
            .checked_add(amount)
            .ok_or(PollError::ArithmeticOverflow)?;

        // -------------------------------------------------------------------
        // TokensPurchased event emit karte hain.
        // -------------------------------------------------------------------
        emit!(TokensPurchased {
            buyer: ctx.accounts.buyer.key(),
            amount,
            sol_cost: total_sol_cost,
            fee,
        });

        Ok(())
    }

    // ========================================================================
    // INSTRUCTION 7: CREATE PROPOSAL (User)
    // ========================================================================
    // User naya proposal (poll) create karta hai.
    //
    // Flow:
    // 1. Validate inputs (question, options, deadline)
    // 2. Check: User ke paas enough tokens hain?
    // 3. Transfer tokens: User → Proposal Escrow
    // 4. Proposal account me sari details save karo
    // 5. Proposal counter increment karo
    // 6. ProposalCreated event emit karo
    //
    // Example:
    //   U1 calls create_proposal(
    //     question: "Best blockchain?",
    //     options: ["Solana", "Ethereum", "Polygon"],
    //     deadline: current_time + 86400
    //   )
    //   → 10 tokens U1 se → Proposal Escrow me
    //   → Proposal LIVE
    // ========================================================================
    pub fn create_proposal(
        ctx: Context<CreateProposal>,
        question: String,
        options: Vec<String>,
        deadline: i64,
    ) -> Result<()> {
        // -------------------------------------------------------------------
        // Input validation — sari checks ek saath.
        // -------------------------------------------------------------------

        // Question empty nahi hona chahiye.
        require!(!question.is_empty(), PollError::EmptyQuestion);
        // Question 200 characters se zyada nahi hona chahiye.
        require!(question.len() <= 200, PollError::QuestionTooLong);
        // Kam se kam 2 options chahiye — warna voting ka kya matlab.
        require!(options.len() >= 2, PollError::TooFewOptions);
        // Zyada se zyada 10 options — storage aur UI limitation.
        require!(options.len() <= 10, PollError::TooManyOptions);

        // Har option validate karte hain — empty ya too long nahi hona chahiye.
        for option in &options {
            require!(!option.is_empty(), PollError::EmptyOption);
            require!(option.len() <= 50, PollError::OptionTooLong);
        }

        // -------------------------------------------------------------------
        // Deadline future me hona chahiye.
        //
        // Clock::get()? → Solana runtime se current time lete hain.
        // clock.unix_timestamp → current Unix timestamp in seconds.
        //
        // Note: Solana ka time perfectly accurate nahi hota — 1-2 seconds
        // ka difference ho sakta hai, but generally reliable hai.
        // -------------------------------------------------------------------
        let clock = Clock::get()?;
        require!(
            deadline > clock.unix_timestamp,
            PollError::DeadlineMustBeInFuture
        );

        // -------------------------------------------------------------------
        // Check: User ke paas enough tokens hain proposal cost ke liye.
        // -------------------------------------------------------------------
        let proposal_cost = ctx.accounts.treasury.proposal_cost;
        require!(
            ctx.accounts.creator_token_account.amount >= proposal_cost,
            PollError::NotEnoughTokensForProposal
        );

        // -------------------------------------------------------------------
        // Tokens transfer: Creator → Proposal Escrow
        //
        // Yaha pe user KHUD sign kar raha hai (PDA nahi), toh CpiContext::new()
        // use hota hai (not new_with_signer).
        //
        // User apne tokens de raha hai escrow me, toh user ka signature chahiye.
        // -------------------------------------------------------------------
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.creator_token_account.to_account_info(),
                    to: ctx.accounts.proposal_escrow.to_account_info(),
                    authority: ctx.accounts.creator.to_account_info(),
                },
            ),
            proposal_cost,
        )?;

        // -------------------------------------------------------------------
        // Proposal account me sari details save karte hain.
        // -------------------------------------------------------------------
        let proposal = &mut ctx.accounts.proposal;

        // Creator ka address — finalize ke time check hoga.
        proposal.creator = ctx.accounts.creator.key();

        // Poll ka question.
        proposal.question = question.clone();

        // -------------------------------------------------------------------
        // vote_counts vector initialize karte hain sare 0s ke saath.
        // vec![0u64; options.len()] → options jitne elements, sab 0.
        // Example: 3 options → vote_counts = [0, 0, 0]
        // -------------------------------------------------------------------
        proposal.vote_counts = vec![0u64; options.len()];

        // Options save karte hain.
        proposal.options = options;

        // Total votes initially 0.
        proposal.total_votes = 0;

        // Deadline save karte hain.
        proposal.deadline = deadline;

        // Abhi finalized nahi hai.
        proposal.is_finalized = false;

        // Escrow accounts ke addresses save karte hain.
        proposal.proposal_escrow = ctx.accounts.proposal_escrow.key();
        proposal.voting_escrow = ctx.accounts.voting_escrow.key();

        // Escrow PDA bumps save karte hain (finalize me sign karne ke liye chahiye).
        proposal.proposal_escrow_bump = ctx.bumps.proposal_escrow;
        proposal.voting_escrow_bump = ctx.bumps.voting_escrow;

        // Current counter value hi is proposal ka ID hai.
        proposal.proposal_id = ctx.accounts.proposal_counter.count;

        // -------------------------------------------------------------------
        // Proposal counter increment karte hain — next proposal ke liye.
        // -------------------------------------------------------------------
        let counter = &mut ctx.accounts.proposal_counter;
        counter.count = counter
            .count
            .checked_add(1)
            .ok_or(PollError::ArithmeticOverflow)?;

        // -------------------------------------------------------------------
        // ProposalCreated event emit karte hain.
        // -------------------------------------------------------------------
        emit!(ProposalCreated {
            proposal: ctx.accounts.proposal.key(),
            creator: ctx.accounts.creator.key(),
            question,
            deadline,
            escrow_amount: proposal_cost,
        });

        Ok(())
    }

    // ========================================================================
    // INSTRUCTION 8: CAST VOTE (User)
    // ========================================================================
    // User kisi proposal pe vote karta hai.
    //
    // Flow:
    // 1. Validate: Option index valid hai?
    // 2. Check: Proposal expired nahi hai?
    // 3. Check: Proposal finalized nahi hai?
    // 4. Check: User ke paas enough tokens hain?
    // 5. Transfer tokens: User → Voting Escrow
    // 6. Vote count update karo
    // 7. VoteRecord save karo (duplicate voting rokne ke liye)
    // 8. VoteCast event emit karo
    //
    // Note: VoteRecord account ka `init` constraint already ensure karta hai
    // ki ek user ek proposal pe sirf ek baar vote kar sake. Agar dubara
    // try kare toh account already exists error aayega.
    //
    // Example:
    //   U2 calls cast_vote(option_index: 0) // Vote for "Solana"
    //   → 1 token U2 se → Voting Escrow me
    //   → vote_counts[0] = 1
    // ========================================================================
    pub fn cast_vote(ctx: Context<CastVote>, option_index: u8) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;

        // -------------------------------------------------------------------
        // Check: Option index valid hai?
        // Example: agar 3 options hain toh valid indices = 0, 1, 2
        // option_index 3 ya usse zyada → InvalidOptionIndex error
        // -------------------------------------------------------------------
        require!(
            (option_index as usize) < proposal.options.len(),
            PollError::InvalidOptionIndex
        );

        // -------------------------------------------------------------------
        // Check: Proposal finalized nahi hona chahiye.
        // Finalize ke baad vote nahi kar sakte.
        // -------------------------------------------------------------------
        require!(!proposal.is_finalized, PollError::ProposalAlreadyFinalized);

        // -------------------------------------------------------------------
        // Check: Deadline abhi pass nahi hua hona chahiye.
        // Agar current time >= deadline → ProposalExpired error.
        // -------------------------------------------------------------------
        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp < proposal.deadline,
            PollError::ProposalExpired
        );

        // -------------------------------------------------------------------
        // Check: User ke paas enough tokens hain vote ke liye.
        // -------------------------------------------------------------------
        let vote_cost = ctx.accounts.treasury.vote_cost;
        require!(
            ctx.accounts.voter_token_account.amount >= vote_cost,
            PollError::NotEnoughTokensForVote
        );

        // -------------------------------------------------------------------
        // Tokens transfer: Voter → Voting Escrow
        // User khud sign kar raha hai.
        // -------------------------------------------------------------------
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.voter_token_account.to_account_info(),
                    to: ctx.accounts.voting_escrow.to_account_info(),
                    authority: ctx.accounts.voter.to_account_info(),
                },
            ),
            vote_cost,
        )?;

        // -------------------------------------------------------------------
        // Vote count update karte hain.
        // vote_counts[option_index] += 1
        //
        // checked_add(1) → overflow protection ke saath increment.
        // -------------------------------------------------------------------
        proposal.vote_counts[option_index as usize] = proposal.vote_counts[option_index as usize]
            .checked_add(1)
            .ok_or(PollError::ArithmeticOverflow)?;

        // Total votes bhi increment karte hain.
        proposal.total_votes = proposal
            .total_votes
            .checked_add(1)
            .ok_or(PollError::ArithmeticOverflow)?;

        // -------------------------------------------------------------------
        // VoteRecord save karte hain — future me duplicate check ke liye.
        //
        // Note: Yeh record already init ho chuka hai (context me `init` hai).
        // Agar yeh user pehle se vote kar chuka hota toh init fail ho jaata
        // kyunki account already exists (automatic duplicate prevention!).
        // -------------------------------------------------------------------
        let vote_record = &mut ctx.accounts.vote_record;
        vote_record.voter = ctx.accounts.voter.key();
        vote_record.proposal = ctx.accounts.proposal.key();
        vote_record.option_index = option_index;

        // -------------------------------------------------------------------
        // VoteCast event emit karte hain.
        // -------------------------------------------------------------------
        emit!(VoteCast {
            proposal: ctx.accounts.proposal.key(),
            voter: ctx.accounts.voter.key(),
            option_index,
            token_cost: vote_cost,
        });

        Ok(())
    }

    // ========================================================================
    // INSTRUCTION 9: FINALIZE PROPOSAL (Creator Only)
    // ========================================================================
    // Proposal creator deadline ke baad proposal finalize karta hai.
    //
    // ESCROW RELEASE:
    // 1. Proposal Escrow tokens → Treasury (proposal_cost wapas treasury me)
    // 2. Voting Escrow tokens → Creator (creator ki kamaai!)
    //
    // Flow:
    // 1. Check: Caller = Creator?
    // 2. Check: Deadline pass ho gaya?
    // 3. Check: Already finalized nahi hai?
    // 4. Transfer: Proposal Escrow → Treasury
    // 5. Transfer: Voting Escrow → Creator
    // 6. Mark as finalized
    // 7. ProposalFinalized event emit karo
    //
    // Example:
    //   Proposal had:
    //     - Proposal Escrow: 10 tokens
    //     - Voting Escrow: 2 tokens (2 voters × 1 token each)
    //   After finalize:
    //     - Treasury gets 10 tokens back
    //     - Creator (U1) gets 2 tokens as earnings!
    // ========================================================================
    pub fn finalize_proposal(ctx: Context<FinalizeProposal>) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;

        // -------------------------------------------------------------------
        // Check: Already finalized nahi hona chahiye.
        // Ek baar finalize ho gaya toh dubara nahi ho sakta.
        // -------------------------------------------------------------------
        require!(!proposal.is_finalized, PollError::ProposalAlreadyFinalized);

        // -------------------------------------------------------------------
        // Check: Deadline pass ho gaya hona chahiye.
        // Voting period khatam hone ke baad hi finalize ho sakta hai.
        // -------------------------------------------------------------------
        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp >= proposal.deadline,
            PollError::ProposalNotExpired
        );

        // -------------------------------------------------------------------
        // Proposal Escrow ke tokens ka amount nikaalte hain.
        // Voting Escrow ke tokens ka amount nikaalte hain.
        // -------------------------------------------------------------------
        let proposal_escrow_amount = ctx.accounts.proposal_escrow.amount;
        let voting_escrow_amount = ctx.accounts.voting_escrow.amount;

        // -------------------------------------------------------------------
        // Step 1: Proposal Escrow → Treasury
        //
        // Proposal escrow ek self-owned PDA token account hai.
        // Seeds: ["proposal_escrow", proposal_key]
        // Authority: proposal_escrow khud hi hai (self-authority PDA)
        //
        // Toh sign karne ke liye proposal_escrow ke seeds chahiye.
        // -------------------------------------------------------------------
        let proposal_key = proposal.key();
        let proposal_escrow_bump = proposal.proposal_escrow_bump;
        let proposal_escrow_seeds: &[&[&[u8]]] = &[&[
            b"proposal_escrow",
            proposal_key.as_ref(),
            &[proposal_escrow_bump],
        ]];

        // Agar proposal escrow me tokens hain tabhi transfer karo.
        if proposal_escrow_amount > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    token::Transfer {
                        from: ctx.accounts.proposal_escrow.to_account_info(),
                        to: ctx.accounts.treasury_token_account.to_account_info(),
                        authority: ctx.accounts.proposal_escrow.to_account_info(),
                    },
                    proposal_escrow_seeds,
                ),
                proposal_escrow_amount,
            )?;
        }

        // -------------------------------------------------------------------
        // Step 2: Voting Escrow → Creator
        //
        // Voting escrow bhi self-owned PDA token account hai.
        // Seeds: ["voting_escrow", proposal_key]
        // Authority: voting_escrow khud hi hai
        //
        // Creator ko voting ke sare tokens milte hain — yeh creator ki kamaai hai!
        // -------------------------------------------------------------------
        let voting_escrow_bump = proposal.voting_escrow_bump;
        let voting_escrow_seeds: &[&[&[u8]]] = &[&[
            b"voting_escrow",
            proposal_key.as_ref(),
            &[voting_escrow_bump],
        ]];

        // Agar voting escrow me tokens hain tabhi transfer karo.
        if voting_escrow_amount > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    token::Transfer {
                        from: ctx.accounts.voting_escrow.to_account_info(),
                        to: ctx.accounts.creator_token_account.to_account_info(),
                        authority: ctx.accounts.voting_escrow.to_account_info(),
                    },
                    voting_escrow_seeds,
                ),
                voting_escrow_amount,
            )?;
        }

        // -------------------------------------------------------------------
        // Proposal ko finalized mark karte hain.
        // Ab is proposal pe na vote ho sakta hai na dubara finalize.
        // -------------------------------------------------------------------
        proposal.is_finalized = true;

        // -------------------------------------------------------------------
        // ProposalFinalized event emit karte hain.
        // -------------------------------------------------------------------
        emit!(ProposalFinalized {
            proposal: proposal_key,
            creator: ctx.accounts.creator.key(),
            proposal_escrow_returned: proposal_escrow_amount,
            voting_escrow_to_creator: voting_escrow_amount,
            total_votes: proposal.total_votes,
        });

        Ok(())
    }

    // ========================================================================
    // INSTRUCTION 10: REDEEM TOKENS (User)
    // ========================================================================
    // User tokens return karke SOL wapas leta hai.
    //
    // Flow:
    // 1. Validate: amount > 0
    // 2. Calculate: SOL value = amount * token_price / decimals
    // 3. Calculate: fee = SOL value * fee_basis_points / 10000
    // 4. Calculate: SOL to user = SOL value - fee
    // 5. Check: Vault me enough SOL hai?
    // 6. Transfer tokens: User → Treasury
    // 7. Transfer SOL: Vault → User (minus fee)
    // 8. TokensRedeemed event emit karo
    //
    // Example:
    //   User redeems 10 tokens:
    //   SOL value = 10 * 0.1 SOL = 1 SOL
    //   Fee = 1 SOL * 10% = 0.1 SOL
    //   User gets = 1 - 0.1 = 0.9 SOL
    //   Tokens go back to treasury
    // ========================================================================
    pub fn redeem_tokens(ctx: Context<RedeemTokens>, amount: u64, min_return: u64) -> Result<()> {
        // -------------------------------------------------------------------
        // Validate input.
        // -------------------------------------------------------------------
        require!(amount > 0, PollError::InvalidRedeemAmount);

        let treasury = &mut ctx.accounts.treasury;

        require!(treasury.is_initialized, PollError::TreasuryNotInitialized);

        // -------------------------------------------------------------------
        // Check: User ke paas enough tokens hain?
        // -------------------------------------------------------------------
        require!(
            ctx.accounts.redeemer_token_account.amount >= amount,
            PollError::InsufficientTokenBalance
        );

        // -------------------------------------------------------------------
        // Bonding Curve Refund Calculation (Batch-based optimization):
        // Har whole token boundary pe price badhta hai.
        // We go backwards from tokens_sold - 1 down to tokens_sold - amount.
        // -------------------------------------------------------------------
        let mut total_refund_u128: u128 = 0;
        let decimals: u64 = 1_000_000;
        let mut remaining_amount = amount;
        let mut current_x = treasury.tokens_sold;

        while remaining_amount > 0 {
            // Next whole token boundary below current_x
            let x_minus_one = current_x
                .checked_sub(1)
                .ok_or(PollError::ArithmeticOverflow)?;
            let boundary_below = (x_minus_one / decimals) * decimals;
            let tokens_to_boundary = current_x
                .checked_sub(boundary_below)
                .ok_or(PollError::ArithmeticOverflow)?;

            let batch_size = std::cmp::min(remaining_amount, tokens_to_boundary);

            let x_whole = x_minus_one / decimals;
            let price_per_full_token = (treasury.base_price as u128)
                .checked_add(
                    (treasury.slope as u128)
                        .checked_mul(x_whole as u128)
                        .ok_or(PollError::ArithmeticOverflow)?,
                )
                .ok_or(PollError::ArithmeticOverflow)?;

            let batch_refund = price_per_full_token
                .checked_mul(batch_size as u128)
                .ok_or(PollError::ArithmeticOverflow)?
                .checked_div(decimals as u128)
                .ok_or(PollError::ArithmeticOverflow)?;

            total_refund_u128 = total_refund_u128
                .checked_add(batch_refund)
                .ok_or(PollError::ArithmeticOverflow)?;

            remaining_amount -= batch_size;
            current_x -= batch_size;
        }

        let sol_value = total_refund_u128 as u64;

        // -------------------------------------------------------------------
        // Fee calculate karte hain.
        // -------------------------------------------------------------------
        let fee = (sol_value as u128)
            .checked_mul(treasury.fee_basis_points as u128)
            .ok_or(PollError::ArithmeticOverflow)?
            .checked_div(10000)
            .ok_or(PollError::ArithmeticOverflow)? as u64;

        // -------------------------------------------------------------------
        // User ko milne wala SOL = value - fee.
        // -------------------------------------------------------------------
        let sol_to_user = sol_value
            .checked_sub(fee)
            .ok_or(PollError::ArithmeticOverflow)?;

        // -------------------------------------------------------------------
        // Slippage Protection: Reject if sol_to_user < min_return
        // -------------------------------------------------------------------
        require!(sol_to_user >= min_return, PollError::SlippageExceeded);

        // -------------------------------------------------------------------
        // Check: Vault me enough SOL hai user ko dene ke liye?
        // -------------------------------------------------------------------
        require!(
            ctx.accounts.vault.lamports() >= sol_to_user,
            PollError::InsufficientVaultBalance
        );

        // -------------------------------------------------------------------
        // Step 1: Token transfer — User → Treasury
        // -------------------------------------------------------------------
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.redeemer_token_account.to_account_info(),
                    to: ctx.accounts.treasury_token_account.to_account_info(),
                    authority: ctx.accounts.redeemer.to_account_info(),
                },
            ),
            amount,
        )?;

        // -------------------------------------------------------------------
        // Step 2: SOL transfer — Vault → User
        // -------------------------------------------------------------------
        let treasury_key = treasury.key();
        let seeds = &[b"vault", treasury_key.as_ref(), &[ctx.bumps.vault]];
        let signer = &[&seeds[..]];

        let cpi_context = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.redeemer.to_account_info(),
            },
            signer,
        );
        system_program::transfer(cpi_context, sol_to_user)?;

        // -------------------------------------------------------------------
        // Update on-chain state: tokens_sold kam ho jaata hai
        // -------------------------------------------------------------------
        treasury.tokens_sold = treasury
            .tokens_sold
            .checked_sub(amount)
            .ok_or(PollError::ArithmeticOverflow)?;

        // -------------------------------------------------------------------
        // TokensRedeemed event emit karte hain.
        // -------------------------------------------------------------------
        emit!(TokensRedeemed {
            redeemer: ctx.accounts.redeemer.key(),
            amount,
            sol_received: sol_to_user,
            fee,
        });

        Ok(())
    }

    // ========================================================================
    // INSTRUCTION 11: WITHDRAW FEES (Admin Only)
    // ========================================================================
    // Admin vault se SOL fees withdraw karta hai apne wallet me.
    //
    // Example: Admin calls withdraw_fees(1_000_000_000)
    // → 1 SOL transferred from Vault PDA to Admin Wallet
    // ========================================================================
    pub fn withdraw_fees(ctx: Context<WithdrawFees>, amount: u64) -> Result<()> {
        // -------------------------------------------------------------------
        // Validate: amount > 0
        // -------------------------------------------------------------------
        require!(amount > 0, PollError::InvalidWithdrawAmount);

        // -------------------------------------------------------------------
        // Check: Vault me enough SOL hai?
        // -------------------------------------------------------------------
        require!(
            ctx.accounts.vault.lamports() >= amount,
            PollError::InsufficientVaultBalance
        );

        // -------------------------------------------------------------------
        // SOL transfer — Vault (PDA) → Admin
        // standard System Transfer logic with seeds for simulation support
        // -------------------------------------------------------------------
        let treasury_key = ctx.accounts.treasury.key();
        let seeds = &[b"vault", treasury_key.as_ref(), &[ctx.bumps.vault]];
        let signer = &[&seeds[..]];

        let cpi_context = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.admin.to_account_info(),
            },
            signer,
        );
        system_program::transfer(cpi_context, amount)?;

        // -------------------------------------------------------------------
        // FeesWithdrawn event emit karte hain.
        // -------------------------------------------------------------------
        emit!(FeesWithdrawn {
            admin: ctx.accounts.admin.key(),
            amount,
        });

        Ok(())
    }

    // ========================================================================
    // INSTRUCTION 10: CREATE GAME POOL (Flip a Coin)
    // ========================================================================
    // User naya game pool create karta hai Head ya Tail choose karke.
    // Bet tokens escrow me lock ho jaate hain.
    // ========================================================================
    pub fn create_game_pool(ctx: Context<CreateGamePool>, amount: u64, choice: u8) -> Result<()> {
        require!(amount > 0, PollError::InvalidBetAmount);
        require!(choice <= 1, PollError::InvalidGameChoice);

        let game_pool = &mut ctx.accounts.game_pool;
        let game_counter = &mut ctx.accounts.game_counter;

        game_pool.creator = ctx.accounts.creator.key();
        game_pool.amount = amount;
        game_pool.creator_choice = choice;
        game_pool.pool_id = game_counter.count;
        game_pool.status = 0; // Open
        game_pool.bump = ctx.bumps.game_pool;

        // Transfer tokens from creator to escrow
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.creator_token_account.to_account_info(),
                    to: ctx.accounts.game_escrow.to_account_info(),
                    authority: ctx.accounts.creator.to_account_info(),
                },
            ),
            amount,
        )?;

        // Increment counter for next pool ID
        game_counter.count += 1;

        emit!(GamePoolCreated {
            pool_id: game_pool.pool_id,
            creator: game_pool.creator,
            amount,
            choice,
        });

        Ok(())
    }

    // ========================================================================
    // INSTRUCTION 11: JOIN GAME POOL (Flip a Coin)
    // ========================================================================
    // Doosra user game join karta hai. Result instantly resolve hota hai.
    // Winner reward receive karta hai minus admin fee.
    // ========================================================================
    pub fn join_game_pool(ctx: Context<JoinGamePool>) -> Result<()> {
        let game_pool = &mut ctx.accounts.game_pool;
        let amount = game_pool.amount;

        // Transfer tokens from joiner to escrow
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.joiner_token_account.to_account_info(),
                    to: ctx.accounts.game_escrow.to_account_info(),
                    authority: ctx.accounts.joiner.to_account_info(),
                },
            ),
            amount,
        )?;

        game_pool.opponent = Some(ctx.accounts.joiner.key());

        // Simple Randomness Logic (Slot ^ Timestamp)
        let clock = Clock::get()?;
        let random_res = (clock.slot ^ clock.unix_timestamp as u64) % 2;
        let result = random_res as u8;
        game_pool.result = Some(result);

        // Determine Winner
        let winner = if game_pool.creator_choice == result {
            game_pool.creator
        } else {
            ctx.accounts.joiner.key()
        };
        game_pool.winner = Some(winner);
        game_pool.status = 1; // Resolved

        // Reward logic
        let total_pool = amount.checked_mul(2).ok_or(PollError::ArithmeticOverflow)?;

        // Signing for Escrow transfer (PDA derivation)
        let pool_id_bytes = game_pool.pool_id.to_le_bytes();
        let seeds = &[
            b"game_pool",
            ctx.accounts.treasury.to_account_info().key.as_ref(),
            pool_id_bytes.as_ref(),
            &[game_pool.bump],
        ];
        let signer = &[&seeds[..]];

        // 1. Transfer Winner Reward
        let winner_ata = if winner == game_pool.creator {
            ctx.accounts.creator_token_account.to_account_info()
        } else {
            ctx.accounts.joiner_token_account.to_account_info()
        };

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.game_escrow.to_account_info(),
                    to: winner_ata,
                    authority: game_pool.to_account_info(),
                },
                signer,
            ),
            total_pool, // Award full pool to winner
        )?;

        emit!(GameResolved {
            pool_id: game_pool.pool_id,
            winner,
            loser: if winner == game_pool.creator {
                ctx.accounts.joiner.key()
            } else {
                game_pool.creator
            },
            result,
            total_pool,
            fee: 0,
        });

        Ok(())
    }

    // ========================================================================
    // INSTRUCTION 13: PLAY JACKPOT (Exact Match Jackpot)
    // ========================================================================
    // User ek single-player game khelta hai system ke against.
    //
    // Flow:
    // 1. Validate inputs: range_max (2-1000), chosen_number (1-range_max), bet > 0
    // 2. Check: Treasury me enough tokens hain payout ke liye (bet * range_max)?
    // 3. Transfer bet tokens: Player → Jackpot Escrow (lock hote hain)
    // 4. Generate random number: (slot XOR timestamp) % range_max + 1
    // 5. Compare: chosen_number == generated_number?
    //    WIN:
    //      a. Escrow → Treasury (bet tokens)
    //      b. Treasury → Player (payout = bet * range_max)
    //    LOSS:
    //      a. Escrow → Treasury (bet tokens — direct loss)
    // 6. Save game state, increment counter, emit event
    //
    // Parameters:
    // - bet_amount: Tokens to bet (smallest units)
    // - range_max: Upper limit of range (2 to 1000)
    // - chosen_number: Player's guess (1 to range_max inclusive)
    // ========================================================================
    pub fn play_jackpot(
        ctx: Context<PlayJackpot>,
        bet_amount: u64,
        range_max: u64,
        chosen_number: u64,
    ) -> Result<()> {
        // -------------------------------------------------------------------
        // Input Validation
        // -------------------------------------------------------------------
        require!(bet_amount > 0, PollError::InvalidBetAmount);
        // Range minimum 2 (taaki kam se kam 2 numbers hon), max 1000
        require!(
            range_max >= 2 && range_max <= 1000,
            PollError::InvalidJackpotRange
        );
        // Chosen number range ke andar hona chahiye (1 se range_max tak, inclusive)
        require!(
            chosen_number >= 1 && chosen_number <= range_max,
            PollError::InvalidChosenNumber
        );

        // -------------------------------------------------------------------
        // Payout amount calculate karte hain: bet * range_max
        // Agar range 1-5 hai aur bet 10 tokens → payout = 50 tokens
        // -------------------------------------------------------------------
        let payout = bet_amount
            .checked_mul(range_max)
            .ok_or(PollError::ArithmeticOverflow)?;

        // -------------------------------------------------------------------
        // Check: Treasury me enough tokens hain payout ke liye?
        // Yeh check pehle karte hain escrow lock se, taaki user fail na ho
        // -------------------------------------------------------------------
        require!(
            ctx.accounts.treasury_token_account.amount >= payout,
            PollError::InsufficientTreasuryForJackpot
        );

        // -------------------------------------------------------------------
        // Step 1: Bet tokens lock karo — Player → Jackpot Escrow
        // User apni bet de raha hai, toh user ka signature chahiye.
        // CpiContext::new() use hoga (not new_with_signer).
        // -------------------------------------------------------------------
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.player_token_account.to_account_info(),
                    to: ctx.accounts.jackpot_escrow.to_account_info(),
                    authority: ctx.accounts.player.to_account_info(),
                },
            ),
            bet_amount,
        )?;

        // -------------------------------------------------------------------
        // Step 2: Random Number Generate karo
        // Solana me true randomness nahi hoti. Hum slot aur timestamp ko
        // XOR karke ek pseudo-random number generate karte hain.
        // Yeh production VRF (Switchboard/Chainlink) se better nahi hai,
        // but devnet aur demo purposes ke liye sufficient hai.
        //
        // Formula: generated = (slot XOR unix_timestamp) % range_max + 1
        // Result range: [1, range_max] (inclusive)
        // -------------------------------------------------------------------
        let clock = Clock::get()?;
        let random_seed = clock.slot ^ (clock.unix_timestamp as u64);
        let generated_number = (random_seed % range_max) + 1; // 1-indexed

        // -------------------------------------------------------------------
        // Step 3: Win ya Loss decide karo
        // -------------------------------------------------------------------
        let is_win = chosen_number == generated_number;

        // -------------------------------------------------------------------
        // JackpotGame PDA ke signer seeds prepare karo.
        // Escrow ki authority jackpot_game PDA hai.
        // Toh escrow se tokens nikalne ke liye jackpot_game sign karega.
        // -------------------------------------------------------------------
        let jackpot_counter = &ctx.accounts.jackpot_counter;
        let treasury_key = ctx.accounts.treasury.key();
        let game_id = jackpot_counter.count;
        let game_id_bytes = game_id.to_le_bytes();

        // jackpot_game PDA seeds: ["jackpot_game", treasury, game_id_le_bytes]
        let jackpot_game_bump = ctx.bumps.jackpot_game;
        let game_signer_seeds: &[&[&[u8]]] = &[&[
            b"jackpot_game",
            treasury_key.as_ref(),
            game_id_bytes.as_ref(),
            &[jackpot_game_bump],
        ]];

        // -------------------------------------------------------------------
        // Treasury PDA ke signer seeds — treasury se tokens transfer ke liye.
        // -------------------------------------------------------------------
        let admin_key = ctx.accounts.treasury.admin;
        let treasury_bump = ctx.bumps.treasury;
        let treasury_signer_seeds: &[&[&[u8]]] =
            &[&[b"treasury", admin_key.as_ref(), &[treasury_bump]]];

        // -------------------------------------------------------------------
        // Step 4a: Escrow → Treasury (Bet tokens hamesha treasury ko jaate hain)
        // Chahe win ho ya loss, escrow me jo tokens hain woh treasury ko jaate hain.
        // -------------------------------------------------------------------
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.jackpot_escrow.to_account_info(),
                    to: ctx.accounts.treasury_token_account.to_account_info(),
                    authority: ctx.accounts.jackpot_game.to_account_info(),
                },
                game_signer_seeds,
            ),
            bet_amount,
        )?;

        // -------------------------------------------------------------------
        // Step 4b (Win only): Treasury → Player (Payout = bet * range_max)
        // Sirf win hone pe treasury se user ko payout milta hai.
        // -------------------------------------------------------------------
        let actual_payout = if is_win {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    token::Transfer {
                        from: ctx.accounts.treasury_token_account.to_account_info(),
                        to: ctx.accounts.player_token_account.to_account_info(),
                        authority: ctx.accounts.treasury.to_account_info(),
                    },
                    treasury_signer_seeds,
                ),
                payout,
            )?;
            payout
        } else {
            0
        };

        // -------------------------------------------------------------------
        // Buy/Sell Simulate Tokenomics Logic
        // -------------------------------------------------------------------
        if is_win {
            // WIN EVENT = Simulated BUY (Demand Increases)
            // User net profit nikal kar usko tokens_sold me add kar dete hain.
            let net_profit = payout.saturating_sub(bet_amount);
            ctx.accounts.treasury.tokens_sold =
                ctx.accounts.treasury.tokens_sold.saturating_add(net_profit);
        } else {
            // LOSS EVENT = Simulated REDEEM/SELL (Supply returning to House)
            // Tokens treasury me wapas aaye, yani circulating supply decrease hui.
            ctx.accounts.treasury.tokens_sold =
                ctx.accounts.treasury.tokens_sold.saturating_sub(bet_amount);
        }

        // -------------------------------------------------------------------
        // Game state save karte hain.
        // -------------------------------------------------------------------
        let jackpot_game = &mut ctx.accounts.jackpot_game;
        jackpot_game.player = ctx.accounts.player.key();
        jackpot_game.bet_amount = bet_amount;
        jackpot_game.range_max = range_max;
        jackpot_game.chosen_number = chosen_number;
        jackpot_game.generated_number = generated_number;
        jackpot_game.is_win = is_win;
        jackpot_game.game_id = game_id;
        jackpot_game.bump = jackpot_game_bump;

        // -------------------------------------------------------------------
        // Counter increment karte hain next game ke liye.
        // -------------------------------------------------------------------
        let counter = &mut ctx.accounts.jackpot_counter;
        counter.count = counter
            .count
            .checked_add(1)
            .ok_or(PollError::ArithmeticOverflow)?;

        // -------------------------------------------------------------------
        // JackpotPlayed event emit karte hain.
        // -------------------------------------------------------------------
        emit!(JackpotPlayed {
            game_id,
            player: ctx.accounts.player.key(),
            bet_amount,
            range_max,
            chosen_number,
            generated_number,
            is_win,
            payout: actual_payout,
        });

        Ok(())
    }
}
