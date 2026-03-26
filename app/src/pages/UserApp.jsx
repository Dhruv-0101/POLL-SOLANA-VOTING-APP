import React, { useState, useEffect } from 'react';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { 
  Coins, BarChart3, Fingerprint, Settings, Zap, ArrowRight, CheckCircle, 
  RotateCcw, LayoutDashboard, FilePlus, Vote, TrendingUp, Wallet, Users
} from 'lucide-react';
import { 
  Program, AnchorProvider, BN 
} from '@coral-xyz/anchor';
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { 
    TOKEN_PROGRAM_ID, 
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getAssociatedTokenAddressSync 
} from '@solana/spl-token';
import idl from '../idl/polldotsol.json';

const UserApp = () => {
    const { connection } = useConnection();
    const anchorWallet = useAnchorWallet();
    
    // UI State
    const [activeTab, setActiveTab] = useState('buy'); // buy, create, vote, earnings, game
    const [logs, setLogs] = useState(() => {
        const saved = localStorage.getItem('user_logs');
        return saved ? JSON.parse(saved) : [];
    });
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Blockchain State (Updated Dynamically from Treasury)
    const [pollBalance, setPollBalance] = useState(0);
    const [solBalance, setSolBalance] = useState(0);
    const [vaultBalance, setVaultBalance] = useState(0);
    const [basePrice, setBasePrice] = useState(0);
    const [slope, setSlope] = useState(0);
    const [tokensSold, setTokensSold] = useState(0);
    const [feePercentage, setFeePercentage] = useState(0);
    const [tokenSymbol, setTokenSymbol] = useState("TOKEN");
    const [decimals, setDecimals] = useState(() => Number(localStorage.getItem('tokenDecimals')) || 6);
    const [proposalCost, setProposalCost] = useState(0);
    const [voteCost, setVoteCost] = useState(0);
    const [slippage, setSlippage] = useState(1); // 1% fallback

    // --- Flip a Coin State ---
    const [gamePools, setGamePools] = useState([]);
    const [betAmount, setBetAmount] = useState(10);
    const [userChoice, setUserChoice] = useState(0); // 0: Head, 1: Tail
    const [isCreatingPool, setIsCreatingPool] = useState(false);
    const [isJoiningPool, setIsJoiningPool] = useState(false);
    const [gameIdInput, setGameIdInput] = useState("");
    const [isFlipping, setIsFlipping] = useState(false);
    const [lastGameResult, setLastGameResult] = useState(null);

    // Buy Tokens State
    const [buyAmount, setBuyAmount] = useState(10);
    const [isBuying, setIsBuying] = useState(false);

    // Create Proposal State
    const [question, setQuestion] = useState("");
    const [options, setOptions] = useState(["Solana", "Ethereum", "Polygon"]);
    const [deadlineValue, setDeadlineValue] = useState(24);
    const [deadlineUnit, setDeadlineUnit] = useState("hours"); // minutes, hours, days
    const [isCreating, setIsCreating] = useState(false);

    // Vote State
    const [proposals, setProposals] = useState([]);
    const [isVoting, setIsVoting] = useState(false);
    const [votedProposals, setVotedProposals] = useState(new Map());

    // Redeem State
    const [redeemAmount, setRedeemAmount] = useState(10);
    const [isRedeeming, setIsRedeeming] = useState(false);
    const [totalRedeemed, setTotalRedeemed] = useState(() => {
        const saved = localStorage.getItem('total_redeemed');
        return saved ? Number(saved) : 0;
    });
    const [totalEarned, setTotalEarned] = useState(() => {
        const saved = localStorage.getItem('total_earned');
        return saved ? Number(saved) : 0;
    });

    useEffect(() => {
        localStorage.setItem('total_earned', totalEarned.toString());
    }, [totalEarned]);

    useEffect(() => {
        localStorage.setItem('total_redeemed', totalRedeemed.toString());
    }, [totalRedeemed]);

    useEffect(() => {
        localStorage.setItem('user_logs', JSON.stringify(logs));
    }, [logs]);

    const appendLog = (message, error = false) => {
        const time = new Date().toLocaleTimeString();
        setLogs(prev => [{ time, message, error }, ...prev]);
    };

    // The main Platform Admin (Hardcoded default, but updated dynamically if treasury is found)
    const ADMIN_PUBKEY = new PublicKey("DGdVqMmRbK816G6Dz4PD9LBh9erXoga2uJJYdGzzebeX");
    const [adminPubkey, setAdminPubkey] = useState(ADMIN_PUBKEY);

    const fetchProgramState = async () => {
        if (!anchorWallet) return;
        setIsRefreshing(true);
        
        try {
            const provider = new AnchorProvider(connection, anchorWallet, { preflightCommitment: "confirmed" });
            const program = new Program(idl, provider);
            
            // Dynamic Fetch: Search for the first treasury on the program
            const allTreasuries = await program.account.treasury.all();
            if (allTreasuries.length === 0) {
                appendLog("Error: No Treasury found. Admin must setup first!", true);
                setIsRefreshing(false);
                return;
            }

            const treasuryState = allTreasuries[0].account;
            const treasuryPda = allTreasuries[0].publicKey;
            
            console.log("--- DYNAMIC CONFIG FETCHED ---");
            console.log("Treasury Admin:", treasuryState.admin.toString());
            console.log("Platform Fee (%):", treasuryState.feeBasisPoints / 100);
            console.log("------------------------------");

            // Set Admin from fetched data
            setAdminPubkey(treasuryState.admin);

            // Fetch Mint Decimals
            const mintPda = treasuryState.mint;
            const mintInfo = await connection.getParsedAccountInfo(mintPda);
            let activeDecimals = decimals;
            if (mintInfo?.value) {
                activeDecimals = mintInfo.value.data.parsed.info.decimals;
                setDecimals(activeDecimals);
                localStorage.setItem('tokenDecimals', activeDecimals);
            }
            
            const divider = new BN(10).pow(new BN(activeDecimals));

            setBasePrice(treasuryState.basePrice.toNumber() / 1e9);
            setSlope(treasuryState.slope.toNumber() / 1e9);
            setTokensSold(treasuryState.tokensSold.toNumber() / divider.toNumber());
            setFeePercentage(treasuryState.feeBasisPoints / 100);
            setProposalCost(treasuryState.proposalCost.toNumber() / divider.toNumber()); 
            setVoteCost(treasuryState.voteCost.toNumber() / divider.toNumber()); 
            
            // Fixed decimals overwrite removed to support dynamic mints.
            // Fetch All Proposals
            const allProps = await program.account.proposal.all();
            // Sort by latest first
            setProposals(allProps.sort((a, b) => b.account.deadline.toNumber() - a.account.deadline.toNumber()));
            
            // Fetch Vote Records for this user to disable UI buttons
            const newVotedMap = new Map();
            for (const prop of allProps) {
                const [voteRecordPda] = PublicKey.findProgramAddressSync(
                    [
                        new TextEncoder().encode("vote_record"),
                        prop.publicKey.toBytes(),
                        anchorWallet.publicKey.toBytes()
                    ],
                    program.programId
                );
                
                try {
                    // Try to fetch the record. If it exists, they voted.
                    const record = await program.account.voteRecord.fetch(voteRecordPda);
                    newVotedMap.set(prop.publicKey.toBase58(), record.optionIndex);
                } catch (e) {
                    // Doesn't exist, they haven't voted. Ignore.
                }
            }
            setVotedProposals(newVotedMap);
            
            // Fetch Mint and Balance
            const mint = treasuryState.mint;
            const userAta = getAssociatedTokenAddressSync(mint, anchorWallet.publicKey);
            
            try {
                const balInfo = await connection.getTokenAccountBalance(userAta);
                setPollBalance(balInfo.value.uiAmount || 0);
            } catch (e) {
                setPollBalance(0);
            }

            const [vaultPda] = PublicKey.findProgramAddressSync(
                [new TextEncoder().encode("vault"), treasuryPda.toBytes()],
                program.programId
            );

            // Fetch SOL Balances
            const [solBal, vaultBal] = await Promise.all([
                connection.getBalance(anchorWallet.publicKey),
                connection.getBalance(vaultPda)
            ]);
            setSolBalance(solBal / 1e9);
            setVaultBalance(vaultBal / 1e9);

            // --- FETCH TOKEN SYMBOL FROM METADATA ---
            try {
                const mint = treasuryState.mint;
                const METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
                const [metadataPda] = PublicKey.findProgramAddressSync(
                    [
                        new TextEncoder().encode("metadata"),
                        METADATA_PROGRAM_ID.toBuffer(),
                        mint.toBuffer(),
                    ],
                    METADATA_PROGRAM_ID
                );
                
                const metadataInfo = await connection.getAccountInfo(metadataPda);
                if (metadataInfo && metadataInfo.data) {
                    // Metaplex Layout: Symbol starts at offset 105, max 10 bytes
                    const symbol = metadataInfo.data.slice(105, 105 + 10).toString('utf8').replace(/\u0000/g, '').trim();
                    if (symbol) {
                        setTokenSymbol(symbol);
                    }
                }
            } catch (err) {
                console.warn("Metadata Fetch Error:", err);
            }

            // --- FETCH GAME POOLS ---
            try {
                const games = await program.account.gamePool.all();
                setGamePools(games.sort((a, b) => b.account.poolId.toNumber() - a.account.poolId.toNumber()));
            } catch (e) {
                console.warn("Games fetch error:", e);
            }

        } catch (err) {
            console.error("Fetch State Error:", err);
        } finally {
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        if (anchorWallet) {
            fetchProgramState();
        }
    }, [anchorWallet]);

    // BONDING CURVE CALCULATION HELPERS
    const calculateCost = (amount, currentSold, base, slp) => {
        if (!amount || amount <= 0) return 0;
        let totalCost = 0;
        let remaining = amount;
        let x = currentSold;

        // Loop through boundaries
        while (remaining > 0) {
            let nextBoundary = Math.floor(x + 1e-9) + 1;
            let availableInBatch = nextBoundary - x;
            let take = Math.min(remaining, availableInBatch);

            if (take <= 0) break;

            let price = base + slp * Math.floor(x + 1e-9);
            totalCost += take * price;

            remaining -= take;
            x += take;
            
            // Safety break for extremely large loops
            if (x > currentSold + 100000) break; 
        }
        return totalCost;
    };

    const calculateRefund = (amount, currentSold, base, slp) => {
        if (!amount || amount <= 0 || currentSold <= 0) return 0;
        let totalRefund = 0;
        let remaining = Math.min(amount, currentSold);
        let x = currentSold;

        while (remaining > 0 && x > 0) {
            let prevBoundary = Math.ceil(x - 1e-9) - 1;
            let availableInBatch = x - Math.max(0, prevBoundary);
            let take = Math.min(remaining, availableInBatch);

            if (take <= 0) break;

            let price = base + slp * Math.floor(x - 1e-9);
            totalRefund += take * price;

            remaining -= take;
            x -= take;
        }
        return totalRefund;
    };


    // BUY TOKENS Logic
    const handleBuyTokens = async () => {
        if (!anchorWallet) {
            alert("Connect wallet first!");
            return;
        }

        setIsBuying(true);
        appendLog(`Buying ${buyAmount} ${tokenSymbol}...`);

        console.log("--- BUY TOKEN DEBUG START ---");
        console.log("Buyer Wallet:", anchorWallet.publicKey.toString());
        console.log("Admin Pubkey:", adminPubkey.toString());
        console.log("Buy Amount (Human):", buyAmount);
        console.log("Token Decimals:", decimals);
        console.log("Live Price (SOL):", livePrice);
        console.log("Fee Percentage:", feePercentage);

        try {
            const provider = new AnchorProvider(connection, anchorWallet, { preflightCommitment: "confirmed" });
            const program = new Program(idl, provider);
            
            const [treasuryPda] = PublicKey.findProgramAddressSync(
                [new TextEncoder().encode("treasury"), adminPubkey.toBytes()],
                program.programId
            );
            console.log("Treasury PDA:", treasuryPda.toString());

            const [mintPda] = PublicKey.findProgramAddressSync(
                [new TextEncoder().encode("mint"), adminPubkey.toBytes()],
                program.programId
            );
            console.log("Mint PDA:", mintPda.toString());

            const [vaultPda] = PublicKey.findProgramAddressSync(
                [new TextEncoder().encode("vault"), treasuryPda.toBytes()],
                program.programId
            );
            console.log("Vault PDA:", vaultPda.toString());

            const treasuryTokenAccount = getAssociatedTokenAddressSync(mintPda, treasuryPda, true);
            const userTokenAccount = getAssociatedTokenAddressSync(mintPda, anchorWallet.publicKey);
            console.log("Treasury Token Account:", treasuryTokenAccount.toString());
            console.log("User Token Account:", userTokenAccount.toString());

            const amountBN = new BN(buyAmount).mul(new BN(10).pow(new BN(decimals)));
            
            // Calculate Max Cost with Slippage
            const calculatedCost = calculateCost(buyAmount, tokensSold, basePrice, slope);
            const totalWithFee = calculatedCost * (1 + feePercentage / 100);
            const maxCostLamports = new BN(Math.floor(totalWithFee * (1 + slippage / 100) * 1e9));

            console.log("Amount in Smallest Units (BN):", amountBN.toString());
            console.log("Max Cost (Lamports):", maxCostLamports.toString());

            console.log("Sending transaction...");
            const tx = await program.methods
                .buyTokens(amountBN, maxCostLamports)
                .accounts({
                    buyer: anchorWallet.publicKey,
                    treasury: treasuryPda,
                    mint: mintPda,
                    vault: vaultPda,
                    treasuryTokenAccount: treasuryTokenAccount,
                    userTokenAccount: userTokenAccount,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            console.log("Transaction Signature:", tx);
            console.log("--- BUY TOKEN DEBUG END (SUCCESS) ---");
            appendLog(`Success! Tx: ${tx.substring(0, 8)}...`);
            setTimeout(fetchProgramState, 2000);
        } catch (err) {
            console.error("--- BUY TOKEN DEBUG END (ERROR) ---");
            console.error("Error Object:", err);
            appendLog(`Error: ${err.message}`, true);
        } finally {
            setIsBuying(false);
        }
    };

    const addOption = () => {
        if (options.length < 10) {
            setOptions([...options, ""]);
        }
    };

    const removeOption = (index) => {
        if (options.length > 2) {
            const newOptions = [...options];
            newOptions.splice(index, 1);
            setOptions(newOptions);
        } else {
            appendLog("Proposal must have at least 2 options!", true);
        }
    };

    const updateOption = (index, value) => {
        const newOptions = [...options];
        newOptions[index] = value;
        setOptions(newOptions);
    };

    // CREATE PROPOSAL Logic
    const handleCreateProposal = async () => {
        if (!anchorWallet) return;
        if (pollBalance < proposalCost) {
            appendLog("Error: Insufficient POLL balance!", true);
            return;
        }

        setIsCreating(true);
        appendLog("Creating new proposal...");

        try {
            const provider = new AnchorProvider(connection, anchorWallet, { preflightCommitment: "confirmed" });
            const program = new Program(idl, provider);
            
            const [treasuryPda] = PublicKey.findProgramAddressSync(
                [new TextEncoder().encode("treasury"), adminPubkey.toBytes()],
                program.programId
            );

            const [mintPda] = PublicKey.findProgramAddressSync(
                [new TextEncoder().encode("mint"), adminPubkey.toBytes()],
                program.programId
            );

            // Fetch current counter
            const [counterPda] = PublicKey.findProgramAddressSync(
                [new TextEncoder().encode("proposal_counter"), treasuryPda.toBytes()],
                program.programId
            );
            
            let currentCount = 0;
            try {
                const counterState = await program.account.proposalCounter.fetch(counterPda);
                currentCount = counterState.count.toNumber();
            } catch (e) {
                // First proposal, counter might not exist yet (program handles init_if_needed)
            }

            const [proposalPda] = PublicKey.findProgramAddressSync(
                [
                    new TextEncoder().encode("proposal"), 
                    treasuryPda.toBytes(), 
                    new BN(currentCount).toArrayLike(Buffer, "le", 8)
                ],
                program.programId
            );

            const [proposalEscrow] = PublicKey.findProgramAddressSync(
                [new TextEncoder().encode("proposal_escrow"), proposalPda.toBytes()],
                program.programId
            );

            const [votingEscrow] = PublicKey.findProgramAddressSync(
                [new TextEncoder().encode("voting_escrow"), proposalPda.toBytes()],
                program.programId
            );

            const creatorTokenAccount = getAssociatedTokenAddressSync(mintPda, anchorWallet.publicKey);

            // Calculate deadline in seconds
            let multiplier = 3600; // default hours
            if (deadlineUnit === "minutes") multiplier = 60;
            if (deadlineUnit === "days") multiplier = 86400;

            const deadlineTimestamp = Math.floor(Date.now() / 1000) + (deadlineValue * multiplier);

            const tx = await program.methods
                .createProposal(question, options, new BN(deadlineTimestamp))
                .accounts({
                    creator: anchorWallet.publicKey,
                    treasury: treasuryPda,
                    mint: mintPda,
                    proposalCounter: counterPda,
                    proposal: proposalPda,
                    proposalEscrow: proposalEscrow,
                    votingEscrow: votingEscrow,
                    creatorTokenAccount: creatorTokenAccount,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            appendLog(`Proposal Created! Tx: ${tx.substring(0, 8)}...`);
            setQuestion("");
            setTimeout(fetchProgramState, 2000);
        } catch (err) {
            console.error("Create Proposal Error:", err);
            appendLog(`Error: ${err.message}`, true);
        } finally {
            setIsCreating(false);
        }
    };

    // CAST VOTE Logic
    const handleCastVote = async (proposalPda, optionIndex) => {
        if (!anchorWallet) return;
        if (pollBalance < voteCost) {
            appendLog("Error: Insufficient POLL balance to vote!", true);
            return;
        }

        setIsVoting(true);
        appendLog(`Casting vote for option ${optionIndex}...`);

        try {
            const provider = new AnchorProvider(connection, anchorWallet, { preflightCommitment: "confirmed" });
            const program = new Program(idl, provider);
            
            const [treasuryPda] = PublicKey.findProgramAddressSync(
                [new TextEncoder().encode("treasury"), adminPubkey.toBytes()],
                program.programId
            );

            const [mintPda] = PublicKey.findProgramAddressSync(
                [new TextEncoder().encode("mint"), adminPubkey.toBytes()],
                program.programId
            );

            const [voteRecordPda] = PublicKey.findProgramAddressSync(
                [new TextEncoder().encode("vote_record"), proposalPda.toBytes(), anchorWallet.publicKey.toBytes()],
                program.programId
            );

            const [votingEscrow] = PublicKey.findProgramAddressSync(
                [new TextEncoder().encode("voting_escrow"), proposalPda.toBytes()],
                program.programId
            );

            const voterTokenAccount = getAssociatedTokenAddressSync(mintPda, anchorWallet.publicKey);

            const tx = await program.methods
                .castVote(optionIndex)
                .accounts({
                    voter: anchorWallet.publicKey,
                    treasury: treasuryPda,
                    mint: mintPda,
                    proposal: proposalPda,
                    voteRecord: voteRecordPda,
                    voterTokenAccount: voterTokenAccount,
                    votingEscrow: votingEscrow,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            appendLog(`Vote Cast! Tx: ${tx.substring(0, 8)}...`);
            
            // Optimistically update local state so UI updates instantly
            setVotedProposals(prev => {
                const newMap = new Map(prev);
                newMap.set(proposalPda.toBase58(), optionIndex);
                return newMap;
            });

            setTimeout(fetchProgramState, 2000);
        } catch (err) {
            console.error("Vote Error:", err);
            if (err.message.includes("already exist")) {
                appendLog("Error: You have already voted on this proposal!", true);
            } else {
                appendLog(`Error: ${err.message}`, true);
            }
        } finally {
            setIsVoting(false);
        }
    };

    // FINALIZE PROPOSAL Logic
    const handleFinalizeProposal = async (proposalPda) => {
        if (!anchorWallet) return;

        appendLog("Finalizing proposal and claiming earnings...");

        try {
            const provider = new AnchorProvider(connection, anchorWallet, { preflightCommitment: "confirmed" });
            const program = new Program(idl, provider);
            
            const [treasuryPda] = PublicKey.findProgramAddressSync(
                [new TextEncoder().encode("treasury"), adminPubkey.toBytes()],
                program.programId
            );

            const [mintPda] = PublicKey.findProgramAddressSync(
                [new TextEncoder().encode("mint"), adminPubkey.toBytes()],
                program.programId
            );

            const [proposalEscrow] = PublicKey.findProgramAddressSync(
                [new TextEncoder().encode("proposal_escrow"), proposalPda.toBytes()],
                program.programId
            );

            const [votingEscrow] = PublicKey.findProgramAddressSync(
                [new TextEncoder().encode("voting_escrow"), proposalPda.toBytes()],
                program.programId
            );

            const treasuryTokenAccount = getAssociatedTokenAddressSync(mintPda, treasuryPda, true);
            const creatorTokenAccount = getAssociatedTokenAddressSync(mintPda, anchorWallet.publicKey);

            const tx = await program.methods
                .finalizeProposal()
                .accounts({
                    creator: anchorWallet.publicKey,
                    treasury: treasuryPda,
                    mint: mintPda,
                    proposal: proposalPda,
                    proposalEscrow: proposalEscrow,
                    votingEscrow: votingEscrow,
                    treasuryTokenAccount: treasuryTokenAccount,
                    creatorTokenAccount: creatorTokenAccount,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            appendLog(`Proposal Finalized! Earnings claimed. Tx: ${tx.substring(0, 8)}...`);
            
            // Update totalEarned from voting escrow
            try {
                const proposalAcc = await program.account.proposal.fetch(proposalPda);
                const earned = (proposalAcc.totalVotes.toNumber() * voteCost);
                setTotalEarned(prev => prev + earned);
            } catch (e) {
                console.error("Error updating earnings:", e);
            }

            setTimeout(fetchProgramState, 2000);
        } catch (err) {
            console.error("Finalize Error:", err);
            appendLog(`Error: ${err.message}`, true);
        }
    };

    // REDEEM TOKENS Logic
    const handleRedeemTokens = async () => {
        if (!anchorWallet) return;
        
        console.log("--- REDEEM TOKEN DEBUG START ---");
        console.log("Redeemer Wallet:", anchorWallet.publicKey.toString());
        console.log("Redeem Amount (Human):", redeemAmount);
        console.log("Live Price:", livePrice);
        console.log("Vault Balance (SOL):", vaultBalance);

        const amountRaw = Math.floor(redeemAmount * (10 ** decimals));
        console.log("Amount Raw (BN):", amountRaw);

        if (amountRaw <= 0) {
            appendLog("Error: Invalid redeem amount", true);
            return;
        }

        if (pollBalance < redeemAmount) {
            appendLog(`Error: Insufficient ${tokenSymbol} balance!`, true);
            return;
        }

        const calculatedRefund = calculateRefund(redeemAmount, tokensSold, basePrice, slope);
        const netRefund = calculatedRefund * (1 - feePercentage / 100);
        const minReturnLamports = new BN(Math.floor(netRefund * (1 - slippage / 100) * 1e9));

        if (vaultBalance < netRefund) {
            appendLog(`Error: Vault has insufficient SOL (${vaultBalance.toFixed(4)} SOL). Please wait for more token purchases!`, true);
            return;
        }

        setIsRedeeming(true);
        appendLog(`Redeeming ${redeemAmount} ${tokenSymbol} for SOL...`);

        try {
            const provider = new AnchorProvider(connection, anchorWallet, { preflightCommitment: "confirmed" });
            const program = new Program(idl, provider);
            
            const [treasuryPda] = PublicKey.findProgramAddressSync(
                [new TextEncoder().encode("treasury"), adminPubkey.toBytes()],
                program.programId
            );

            const [mintPda] = PublicKey.findProgramAddressSync(
                [new TextEncoder().encode("mint"), adminPubkey.toBytes()],
                program.programId
            );

            const [vaultPda] = PublicKey.findProgramAddressSync(
                [new TextEncoder().encode("vault"), treasuryPda.toBytes()],
                program.programId
            );
            console.log("Treasury PDA:", treasuryPda.toString());
            console.log("Vault PDA:", vaultPda.toString());

            const redeemerTokenAccount = getAssociatedTokenAddressSync(mintPda, anchorWallet.publicKey);
            const treasuryTokenAccount = getAssociatedTokenAddressSync(mintPda, treasuryPda, true);
            console.log("Redeemer Token Account:", redeemerTokenAccount.toString());
            console.log("Treasury Token Account:", treasuryTokenAccount.toString());

            // Check actual account data before calling
            try {
                const [rBal, tBal] = await Promise.all([
                    connection.getTokenAccountBalance(redeemerTokenAccount),
                    connection.getTokenAccountBalance(treasuryTokenAccount)
                ]);
                console.log("Voter Token Balance on Chain:", rBal.value.uiAmount);
                console.log("Treasury Token Balance on Chain:", tBal.value.uiAmount);
            } catch (e) {
                console.warn("Could not fetch token account balances - accounts might not exist!", e.message);
            }

            const tx = await program.methods
                .redeemTokens(new BN(amountRaw), minReturnLamports)
                .accounts({
                    redeemer: anchorWallet.publicKey,
                    treasury: treasuryPda,
                    mint: mintPda,
                    vault: vaultPda,
                    redeemerTokenAccount: redeemerTokenAccount,
                    treasuryTokenAccount: treasuryTokenAccount,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            console.log("Redeem Transaction Success Sig:", tx);
            appendLog(`Tokens Redeemed! SOL received. Tx: ${tx.substring(0, 8)}...`);
            setTotalRedeemed(prev => prev + redeemAmount);
            setTimeout(fetchProgramState, 2000);
        } catch (err) {
            console.error("Redeem Error Detailed:", err);
            appendLog(`Error: ${err.message}`, true);
        } finally {
            setIsRedeeming(false);
            console.log("--- REDEEM TOKEN DEBUG END ---");
        }
    };

    // --- CREATE GAME POOL ---
    const handleCreateGamePool = async () => {
        if (!anchorWallet) return;
        if (pollBalance < betAmount) {
            appendLog(`Insufficient ${tokenSymbol} balance!`, true);
            return;
        }

        setIsCreatingPool(true);
        appendLog(`Creating ${betAmount} tokens game pool...`);

        try {
            const provider = new AnchorProvider(connection, anchorWallet, { preflightCommitment: "confirmed" });
            const program = new Program(idl, provider);
            
            const allTreasuries = await program.account.treasury.all();
            const treasuryState = allTreasuries[0].account;
            const treasuryPda = allTreasuries[0].publicKey;
            const mintPda = treasuryState.mint;

            const [counterPda] = PublicKey.findProgramAddressSync(
                [new TextEncoder().encode("game_counter"), treasuryPda.toBytes()],
                program.programId
            );

            let currentCount = 0;
            try {
                const counterState = await program.account.gameCounter.fetch(counterPda);
                currentCount = counterState.count.toNumber();
            } catch (e) {}

            const [gamePoolPda] = PublicKey.findProgramAddressSync(
                [
                    new TextEncoder().encode("game_pool"), 
                    treasuryPda.toBytes(), 
                    new BN(currentCount).toArrayLike(Buffer, "le", 8)
                ],
                program.programId
            );

            const [gameEscrow] = PublicKey.findProgramAddressSync(
                [new TextEncoder().encode("game_escrow"), gamePoolPda.toBytes()],
                program.programId
            );

            const creatorTokenAccount = getAssociatedTokenAddressSync(mintPda, anchorWallet.publicKey);
            const amountBN = new BN(betAmount).mul(new BN(10).pow(new BN(decimals)));

            const tx = await program.methods
                .createGamePool(amountBN, userChoice)
                .accounts({
                    creator: anchorWallet.publicKey,
                    treasury: treasuryPda,
                    mint: mintPda,
                    gameCounter: counterPda,
                    gamePool: gamePoolPda,
                    gameEscrow: gameEscrow,
                    creatorTokenAccount: creatorTokenAccount,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                    rent: SYSVAR_RENT_PUBKEY,
                })
                .rpc();

            appendLog(`Game Created! ID: ${currentCount}. Tx: ${tx.substring(0, 8)}`);
            setTimeout(fetchProgramState, 2000);
        } catch (err) {
            console.error("Create Game Error:", err);
            appendLog(`Error: ${err.message}`, true);
        } finally {
            setIsCreatingPool(false);
        }
    };

    // --- JOIN GAME POOL ---
    const handleJoinGamePool = async (poolData) => {
        if (!anchorWallet) return;
        
        const pool = poolData.account;
        const entryFee = pool.amount.toNumber() / (10 ** decimals);
        
        if (pollBalance < entryFee) {
            appendLog(`Insufficient ${tokenSymbol} for entry fee!`, true);
            return;
        }

        setIsJoiningPool(true);
        appendLog(`Joining Game #${pool.poolId.toNumber()}...`);

        try {
            const provider = new AnchorProvider(connection, anchorWallet, { preflightCommitment: "confirmed" });
            const program = new Program(idl, provider);
            
            const allTreasuries = await program.account.treasury.all();
            const treasuryState = allTreasuries[0].account;
            const treasuryPda = allTreasuries[0].publicKey;
            const mintPda = treasuryState.mint;

            const [gameEscrow] = PublicKey.findProgramAddressSync(
                [new TextEncoder().encode("game_escrow"), poolData.publicKey.toBytes()],
                program.programId
            );

            const joinerTokenAccount = getAssociatedTokenAddressSync(mintPda, anchorWallet.publicKey);
            const creatorTokenAccount = getAssociatedTokenAddressSync(mintPda, pool.creator);

            const tx = await program.methods
                .joinGamePool()
                .accounts({
                    joiner: anchorWallet.publicKey,
                    creator: pool.creator,
                    treasury: treasuryPda,
                    mint: mintPda,
                    gamePool: poolData.publicKey,
                    gameEscrow: gameEscrow,
                    joinerTokenAccount: joinerTokenAccount,
                    creatorTokenAccount: creatorTokenAccount,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                })
                .rpc();

            // Fetch resolved result
            const updatedPool = await program.account.gamePool.fetch(poolData.publicKey);
            const win = updatedPool.winner.equals(anchorWallet.publicKey);
            
            // Flip Animation
            setIsFlipping(true);
            setLastGameResult(null);
            
            setTimeout(() => {
                setIsFlipping(false);
                const winningReward = (pool.amount.toNumber() * 2) / (10 ** decimals);
                setLastGameResult({
                    win,
                    result: updatedPool.result,
                    reward: winningReward
                });
                
                if (win) {
                    // Update totalEarned when user wins coin flip
                    // Note: reward includes the user's own bet, but usually "earned" means profit? 
                    // Let's count full reward towards "Total Earned" dashboard or just profit?
                    // Usually users want to see full reward.
                    setTotalEarned(prev => prev + winningReward);
                }

                appendLog(`Game Resolved: You ${win ? 'WON' : 'LOST'}! Result: ${updatedPool.result === 0 ? 'HEADS' : 'TAILS'}`);
                fetchProgramState();
            }, 3000);

        } catch (err) {
            console.error("Join Game Error:", err);
            appendLog(`Error: ${err.message}`, true);
        } finally {
            setIsJoiningPool(false);
        }
    };

    // --- DERIVED UI STATE ---
    const livePrice = basePrice + (slope * tokensSold);
    
    // UI Calculations (Matching Batch Logic)
    const currentCost = calculateCost(buyAmount, tokensSold, basePrice, slope);
    const buyFee = (currentCost * feePercentage) / 100;
    const buyTotal = currentCost + buyFee;

    // Redeem Calculations
    const currentRefund = calculateRefund(redeemAmount, tokensSold, basePrice, slope);
    const redeemFee = (currentRefund * feePercentage) / 100;
    const redeemNet = currentRefund - redeemFee;

    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: 'var(--bg-color)',
            color: 'var(--text-main)',
            display: 'flex',
            flexDirection: 'column',
        }}>
            {/* TOP HEADER */}
            <header style={{
                padding: '1.25rem 2rem',
                borderBottom: '1px solid var(--card-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'rgba(13, 13, 13, 0.8)',
                backdropFilter: 'blur(10px)',
                position: 'sticky',
                top: 0,
                zIndex: 100
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                        backgroundColor: 'var(--accent-green-dim)',
                        border: '1px solid var(--accent-green-border)',
                        borderRadius: '6px',
                        padding: '0.4rem',
                        display: 'flex'
                    }}>
                        <BarChart3 size={20} color="var(--accent-green)" />
                    </div>
                    <span style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.05em' }}>{tokenSymbol} . SOL</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                    <div style={{ display: 'flex', gap: '1.5rem', borderRight: '1px solid var(--card-border)', paddingRight: '2rem' }}>
                        <div style={{ textAlign: 'right' }}>
                            <div className="font-mono text-dim" style={{ fontSize: '0.65rem' }}>{tokenSymbol} BALANCE</div>
                            <div className="font-mono" style={{ fontSize: '1rem', color: 'var(--accent-green)', fontWeight: 700 }}>
                                {pollBalance.toLocaleString()} {tokenSymbol}
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div className="font-mono text-dim" style={{ fontSize: '0.65rem' }}>SOL BALANCE</div>
                            <div className="font-mono" style={{ fontSize: '1rem', color: 'white', fontWeight: 700 }}>
                                {solBalance.toLocaleString(undefined, { maximumFractionDigits: 9 })} SOL
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button 
                            onClick={fetchProgramState}
                            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
                        >
                            <RotateCcw size={16} className={isRefreshing ? "spin-animation" : ""} />
                        </button>
                        <WalletMultiButton style={{ height: '40px', fontSize: '0.8rem', backgroundColor: '#111', border: '1px solid var(--card-border)' }} />
                    </div>
                </div>
            </header>

            {/* MAIN CONTENT */}
            <div style={{ display: 'flex', flex: 1, padding: '2rem' }}>
                {/* SIDEBAR */}
                <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <nav className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div className="font-mono text-dim text-xs" style={{ padding: '0 0.5rem 0.75rem 0.5rem' }}>// ACTIONS</div>
                        
                        {[
                            { id: 'buy', icon: <Zap size={18} />, label: `Buy ${tokenSymbol}` },
                            { id: 'create', icon: <FilePlus size={18} />, label: 'Create Proposal' },
                            { id: 'vote', icon: <Vote size={18} />, label: 'Vote' },
                            { id: 'game', icon: <Coins size={18} />, label: 'Flip a Coin' },
                            { id: 'earnings', icon: <TrendingUp size={18} />, label: 'Earnings & Redeem' }
                        ].map(item => (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    padding: '0.875rem 1rem',
                                    borderRadius: '8px',
                                    border: 'none',
                                    backgroundColor: activeTab === item.id ? 'var(--accent-green-dim)' : 'transparent',
                                    color: activeTab === item.id ? 'var(--accent-green)' : 'var(--text-dim)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '0.9rem',
                                    textAlign: 'left'
                                }}
                            >
                                {item.icon}
                                {item.label}
                            </button>
                        ))}
                    </nav>

                    {/* STATS SUMMARY (Mini cards) */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                        <div className="card" style={{ padding: '1rem' }}>
                            <div className="text-dim font-mono text-xs uppercase mb-1">Total Earned</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>
                                {anchorWallet 
                                    ? proposals.filter(p => p.account.creator.equals(anchorWallet.publicKey) && p.account.isFinalized)
                                               .reduce((sum, p) => sum + p.account.totalVotes.toNumber(), 0)
                                    : 0
                                } <span style={{ color: 'var(--accent-green)', fontSize: '0.8rem' }}>{tokenSymbol}</span>
                            </div>
                        </div>
                        <div className="card" style={{ padding: '1rem' }}>
                            <div className="text-dim font-mono text-xs uppercase mb-1">Active Proposals</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{proposals.filter(p => p.account.deadline.toNumber() > Date.now()/1000).length}</div>
                        </div>
                    </div>
                </div>

                {/* MAIN AREA */}
                <div style={{ flex: 1, marginLeft: '2rem' }}>
                    {activeTab === 'buy' && (
                        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            <div className="card" style={{ padding: '2.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
                                    <div style={{ color: 'var(--accent-green)', backgroundColor: 'var(--accent-green-dim)', padding: '0.5rem', borderRadius: '50%' }}>
                                        <Zap size={24} />
                                    </div>
                                    <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Buy {tokenSymbol} Tokens</h2>
                                </div>

                                <div style={{ marginBottom: '2rem' }}>
                                    <label className="font-mono text-dim text-xs uppercase mb-2 block">Amount of {tokenSymbol}</label>
                                    <div style={{ position: 'relative' }}>
                                        <input 
                                            type="number" 
                                            value={buyAmount}
                                            onChange={(e) => setBuyAmount(Number(e.target.value))}
                                            style={{
                                                width: '100%',
                                                backgroundColor: '#0a0a0a',
                                                border: '1px solid var(--card-border)',
                                                borderRadius: '10px',
                                                padding: '1.25rem',
                                                fontSize: '1.5rem',
                                                fontWeight: 800,
                                                color: 'white',
                                                outline: 'none',
                                                fontFamily: 'var(--font-mono)'
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Price Summary Card */}
                                <div style={{ 
                                    backgroundColor: '#0a0a0a', 
                                    borderRadius: '12px', 
                                    border: '1px solid var(--card-border)',
                                    padding: '1.5rem',
                                    marginBottom: '2rem'
                                }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span className="text-dim font-mono text-sm">Target Price</span>
                                            <span style={{ fontWeight: 600 }}>{livePrice.toFixed(5)} SOL / {tokenSymbol}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span className="text-dim font-mono text-sm">Subtotal (Bonding Curve)</span>
                                            <span style={{ fontWeight: 600 }}>{currentCost.toFixed(5)} SOL</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span className="text-dim font-mono text-sm">Platform Fee ({feePercentage}%)</span>
                                            <span style={{ fontWeight: 600 }}>{buyFee.toFixed(5)} SOL</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #1a1a1a', paddingTop: '1rem', marginTop: '0.5rem' }}>
                                            <span style={{ fontWeight: 700 }}>Total Cost</span>
                                            <span style={{ fontWeight: 800, color: 'var(--accent-green)', fontSize: '1.25rem' }}>{buyTotal.toFixed(5)} SOL</span>
                                        </div>
                                        <div style={{ marginTop: '1rem' }}>
                                            <label className="font-mono text-dim text-xs uppercase mb-2 block">Slippage Tolerance (%)</label>
                                            <input 
                                                type="number" 
                                                value={slippage}
                                                onChange={(e) => setSlippage(Number(e.target.value))}
                                                style={{ width: '60px', backgroundColor: '#111', border: '1px solid var(--card-border)', borderRadius: '4px', padding: '0.25rem 0.5rem', color: 'white', fontFamily: 'var(--font-mono)' }}
                                            />
                                            <span className="text-dim text-xs ml-2">Recommended: 0.5% - 1%</span>
                                        </div>
                                    </div>
                                </div>

                                <button 
                                    onClick={handleBuyTokens}
                                    disabled={isBuying || !anchorWallet}
                                    className="btn btn-primary"
                                    style={{ 
                                        width: '100%', 
                                        padding: '1.25rem', 
                                        fontSize: '1.1rem', 
                                        fontWeight: 800,
                                        borderRadius: '10px',
                                        opacity: (!anchorWallet || isBuying) ? 0.6 : 1
                                    }}
                                >
                                    <Zap size={20} /> {isBuying ? 'PROCESSING...' : `BUY ${buyAmount} ${tokenSymbol}`}
                                </button>
                            </div>

                            {/* TRANSACTION LOG */}
                            <div className="card" style={{ padding: '1.5rem' }}>
                                <div className="font-mono text-xs text-dim mb-3">// TRANSACTION LOG</div>
                                {logs.length === 0 ? (
                                    <div className="text-dim font-mono text-sm italic">Connect wallet and buy tokens to see logs...</div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                        {logs.map((log, i) => (
                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem' }}>
                                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: log.error ? '#ef4444' : 'var(--accent-green)' }}></div>
                                                <span className="font-mono text-dim">[{log.time}]</span>
                                                <span style={{ color: log.error ? '#ef4444' : 'var(--text-main)' }}>{log.message}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'create' && (
                        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            <div className="card" style={{ padding: '2.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{ color: 'var(--accent-green)', backgroundColor: 'var(--accent-green-dim)', padding: '0.5rem', borderRadius: '50%' }}>
                                            <FilePlus size={24} />
                                        </div>
                                        <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Create Proposal</h2>
                                    </div>
                                    <div className="badge" style={{ backgroundColor: 'var(--accent-green-dim)', color: 'var(--accent-green)', fontSize: '0.7rem' }}>
                                        COST: {proposalCost} {tokenSymbol}
                                    </div>
                                </div>

                                <div style={{ marginBottom: '2rem' }}>
                                    <label className="font-mono text-dim text-xs uppercase mb-2 block">Question</label>
                                    <input 
                                        type="text" 
                                        placeholder="What is the best blockchain?"
                                        value={question}
                                        onChange={(e) => setQuestion(e.target.value)}
                                        className="font-mono"
                                        style={{
                                            width: '100%',
                                            backgroundColor: '#0a0a0a',
                                            border: '1px solid var(--card-border)',
                                            borderRadius: '8px',
                                            padding: '1rem',
                                            fontSize: '1.1rem',
                                            color: 'white',
                                            outline: 'none'
                                        }}
                                    />
                                </div>

                                <div style={{ marginBottom: '2rem' }}>
                                    <label className="font-mono text-dim text-xs uppercase mb-2 block">Options</label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {options.map((opt, i) => (
                                            <div key={i} style={{ display: 'flex', gap: '0.5rem' }}>
                                                <input 
                                                    type="text" 
                                                    value={opt}
                                                    onChange={(e) => updateOption(i, e.target.value)}
                                                    placeholder={`Option ${i+1}`}
                                                    style={{
                                                        flex: 1,
                                                        backgroundColor: '#0a0a0a',
                                                        border: '1px solid var(--card-border)',
                                                        borderRadius: '8px',
                                                        padding: '0.875rem 1rem',
                                                        color: 'white'
                                                    }}
                                                />
                                                <button 
                                                    onClick={() => removeOption(i)}
                                                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                                                >
                                                    <RotateCcw size={18} style={{ transform: 'rotate(45deg)' }} />
                                                </button>
                                            </div>
                                        ))}
                                        {options.length < 10 && (
                                            <button 
                                                onClick={addOption}
                                                style={{ 
                                                    textAlign: 'left', 
                                                    background: 'none', 
                                                    border: '1px dashed var(--card-border)', 
                                                    borderRadius: '8px',
                                                    padding: '0.75rem', 
                                                    color: 'var(--text-dim)', 
                                                    cursor: 'pointer',
                                                    fontSize: '0.8rem'
                                                }}
                                            >
                                                + Add Option
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div style={{ marginBottom: '2.5rem' }}>
                                    <label className="font-mono text-dim text-xs uppercase mb-2 block">Deadline</label>
                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        <input 
                                            type="number" 
                                            value={deadlineValue}
                                            onChange={(e) => setDeadlineValue(Number(e.target.value))}
                                            style={{
                                                flex: 1,
                                                backgroundColor: '#0a0a0a',
                                                border: '1px solid var(--card-border)',
                                                borderRadius: '8px',
                                                padding: '1rem',
                                                color: 'white'
                                            }}
                                        />
                                        <select 
                                            value={deadlineUnit}
                                            onChange={(e) => setDeadlineUnit(e.target.value)}
                                            style={{
                                                backgroundColor: '#0a0a0a',
                                                border: '1px solid var(--card-border)',
                                                borderRadius: '8px',
                                                padding: '0 1rem',
                                                color: 'white'
                                            }}
                                        >
                                            <option value="minutes">Minutes</option>
                                            <option value="hours">Hours</option>
                                            <option value="days">Days</option>
                                        </select>
                                    </div>
                                </div>

                                <button 
                                    onClick={handleCreateProposal}
                                    disabled={isCreating || !anchorWallet || pollBalance < proposalCost || !question}
                                    className="btn btn-primary"
                                    style={{ 
                                        width: '100%', 
                                        padding: '1.25rem', 
                                        fontSize: '1.1rem', 
                                        fontWeight: 800,
                                        borderRadius: '10px'
                                    }}
                                >
                                    {isCreating ? 'PUBLISHING...' : `CREATE PROPOSAL (${proposalCost} ${tokenSymbol})`}
                                </button>
                                
                                {pollBalance < proposalCost && anchorWallet && (
                                    <p style={{ color: '#ef4444', fontSize: '0.8rem', textAlign: 'center', marginTop: '1rem' }}>
                                        Insufficient {tokenSymbol} — buy tokens first
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'vote' && (
                        <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '1.5rem' }}>
                            {proposals.length === 0 ? (
                                <div className="card" style={{ gridColumn: '1 / -1', padding: '4rem', textAlign: 'center' }}>
                                    <div className="text-dim font-mono mb-2">NO PROPOSALS FOUND</div>
                                    <p className="text-dim text-sm">Be the first one to create a proposal!</p>
                                </div>
                            ) : (
                                proposals.map((p, i) => {
                                    const isExpired = p.account.deadline.toNumber() < Date.now() / 1000;
                                    const totalVotes = p.account.totalVotes.toNumber();
                                    
                                    return (
                                        <div key={i} className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div className="badge" style={{ 
                                                    backgroundColor: p.account.isFinalized ? 'rgba(100, 100, 100, 0.1)' : (isExpired ? 'rgba(239, 68, 68, 0.1)' : 'var(--accent-green-dim)'), 
                                                    color: p.account.isFinalized ? '#888' : (isExpired ? '#ef4444' : 'var(--accent-green)') 
                                                }}>
                                                    {p.account.isFinalized ? 'FINALIZED' : (isExpired ? 'CLOSED' : 'ACTIVE')}
                                                </div>
                                                <div className="font-mono text-dim" style={{ fontSize: '0.7rem' }}>
                                                    ID: #{p.account.proposalId.toString()}
                                                </div>
                                            </div>

                                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0.5rem 0' }}>{p.account.question}</h3>
                                            
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                {p.account.options.map((opt, optIdx) => {
                                                    const votes = p.account.voteCounts[optIdx].toNumber();
                                                    const percent = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
                                                    
                                                    const userVotedForThisProposal = votedProposals.has(p.publicKey.toBase58());
                                                    const userVotedForThisOption = userVotedForThisProposal && votedProposals.get(p.publicKey.toBase58()) === optIdx;
                                                    
                                                    return (
                                                        <div key={optIdx} style={{ position: 'relative' }}>
                                                            <button
                                                                onClick={() => handleCastVote(p.publicKey, optIdx)}
                                                                disabled={isVoting || isExpired || pollBalance < voteCost || userVotedForThisProposal}
                                                                style={{
                                                                    width: '100%',
                                                                    backgroundColor: '#0a0a0a',
                                                                    border: '1px solid var(--card-border)',
                                                                    borderRadius: '8px',
                                                                    padding: '0.875rem 1rem',
                                                                    color: userVotedForThisOption ? 'var(--accent-green)' : 'white',
                                                                    textAlign: 'left',
                                                                    display: 'flex',
                                                                    justifyContent: 'space-between',
                                                                    alignItems: 'center',
                                                                    cursor: (isVoting || isExpired || userVotedForThisProposal) ? 'default' : 'pointer',
                                                                    position: 'relative',
                                                                    overflow: 'hidden',
                                                                    zIndex: 1,
                                                                    opacity: (isExpired && !userVotedForThisOption) ? 0.6 : 1
                                                                }}
                                                            >
                                                                <div style={{ 
                                                                    position: 'absolute', 
                                                                    left: 0, 
                                                                    top: 0, 
                                                                    height: '100%', 
                                                                    width: `${percent}%`, 
                                                                    backgroundColor: 'rgba(57, 255, 20, 0.05)',
                                                                    zIndex: -1,
                                                                    transition: 'width 1s ease'
                                                                }}></div>
                                                                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                                                                    {opt} {userVotedForThisOption && <span style={{ fontSize: '0.7rem', marginLeft: '0.5rem' }}>✓ VOTED</span>}
                                                                </span>
                                                                <span className="font-mono text-dim" style={{ fontSize: '0.75rem' }}>{votes} votes ({Math.round(percent)}%)</span>
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <Users size={14} className="text-dim" />
                                                        <span className="font-mono text-dim" style={{ fontSize: '0.75rem' }}>{totalVotes} Total</span>
                                                    </div>
                                                    <div className="font-mono" style={{ fontSize: '0.75rem', color: isExpired ? '#ef4444' : 'var(--text-dim)' }}>
                                                        {p.account.isFinalized ? 'FINALIZED' : (isExpired ? 'Ended' : `Ends: ${new Date(p.account.deadline.toNumber() * 1000).toLocaleString()}`)}
                                                    </div>
                                                </div>

                                                {/* Finalize Button for Creator */}
                                                {isExpired && !p.account.isFinalized && anchorWallet && p.account.creator.equals(anchorWallet.publicKey) && (
                                                    <button 
                                                        onClick={() => handleFinalizeProposal(p.publicKey)}
                                                        className="btn btn-primary"
                                                        style={{ width: '100%', padding: '0.75rem', fontSize: '0.85rem' }}
                                                    >
                                                        Finalize & Claim {totalVotes} {tokenSymbol}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}

                    {activeTab === 'earnings' && (
                        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            {/* EARNINGS SUMMARY SECTION */}
                            <div className="card" style={{ padding: '2.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                                    <div style={{ color: 'var(--accent-green)', backgroundColor: 'var(--accent-green-dim)', padding: '0.5rem', borderRadius: '50%' }}>
                                        <TrendingUp size={24} />
                                    </div>
                                    <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Creator Earnings</h2>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
                                    <div style={{ backgroundColor: '#0a0a0a', border: '1px solid var(--card-border)', padding: '1.5rem', borderRadius: '12px' }}>
                                        <div className="text-dim font-mono text-xs uppercase mb-2">Total Earned</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>
                                            {totalEarned} <span style={{ color: 'var(--accent-green)', fontSize: '0.9rem' }}>{tokenSymbol}</span>
                                        </div>
                                    </div>
                                    <div style={{ backgroundColor: '#0a0a0a', border: '1px solid var(--card-border)', padding: '1.5rem', borderRadius: '12px' }}>
                                        <div className="text-dim font-mono text-xs uppercase mb-2">Current Balance</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>
                                            {pollBalance} <span style={{ color: 'var(--accent-green)', fontSize: '0.9rem' }}>{tokenSymbol}</span>
                                        </div>
                                    </div>
                                    <div style={{ backgroundColor: '#0a0a0a', border: '1px solid var(--card-border)', padding: '1.5rem', borderRadius: '12px' }}>
                                        <div className="text-dim font-mono text-xs uppercase mb-2">Total Redeemed</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>
                                            {totalRedeemed} <span style={{ color: 'var(--accent-green)', fontSize: '0.9rem' }}>{tokenSymbol}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* REDEEM PANEL */}
                            <div className="card" style={{ padding: '2.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{ color: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '0.5rem', borderRadius: '50%' }}>
                                            <RotateCcw size={24} />
                                        </div>
                                        <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Redeem Tokens</h2>
                                    </div>
                                    <div className="badge" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', fontSize: '0.7rem' }}>
                                        {tokenSymbol} → SOL
                                    </div>
                                </div>

                                <div style={{ marginBottom: '2rem' }}>
                                    <label className="font-mono text-dim text-xs uppercase mb-2 block">{tokenSymbol} TO REDEEM</label>
                                    <input 
                                        type="number" 
                                        value={redeemAmount}
                                        onChange={(e) => setRedeemAmount(Number(e.target.value))}
                                        style={{
                                            width: '100%',
                                            backgroundColor: '#0a0a0a',
                                            border: '1px solid var(--card-border)',
                                            borderRadius: '10px',
                                            padding: '1.25rem',
                                            fontSize: '1.5rem',
                                            fontWeight: 800,
                                            color: 'white',
                                            outline: 'none',
                                            fontFamily: 'var(--font-mono)'
                                        }}
                                    />
                                </div>

                                <div style={{ backgroundColor: '#0a0a0a', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span className="text-dim font-mono text-sm">Target Price</span>
                                            <span style={{ fontWeight: 600 }}>{livePrice.toFixed(5)} SOL</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span className="text-dim font-mono text-sm">Redeem Value (Bonding Curve)</span>
                                            <span style={{ fontWeight: 600 }}>{currentRefund.toFixed(5)} SOL</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span className="text-dim font-mono text-sm">Platform Fee ({feePercentage}%)</span>
                                            <span style={{ fontWeight: 600, color: '#ef4444' }}>-{redeemFee.toFixed(5)} SOL</span>
                                        </div>
                                        <div style={{ height: '1px', backgroundColor: 'var(--card-border)', margin: '0.5rem 0' }}></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ fontWeight: 800 }}>You Receive (Est.)</span>
                                            <span style={{ fontWeight: 800, color: 'var(--accent-green)' }}>{redeemNet.toFixed(5)} SOL</span>
                                        </div>
                                    </div>
                                </div>

                                <button 
                                    onClick={handleRedeemTokens}
                                    disabled={isRedeeming || !anchorWallet || pollBalance < redeemAmount}
                                    className="btn btn-primary"
                                    style={{ 
                                        width: '100%', 
                                        padding: '1.25rem', 
                                        fontSize: '1.1rem', 
                                        fontWeight: 800,
                                        borderRadius: '10px',
                                        backgroundColor: '#111',
                                        border: '1px solid #333',
                                        color: '#f59e0b'
                                    }}
                                >
                                    <RotateCcw size={20} /> {isRedeeming ? 'PROCESSING...' : `REDEEM ${redeemAmount} ${tokenSymbol}`}
                                </button>
                                
                                {pollBalance < redeemAmount && anchorWallet && (
                                    <p style={{ color: '#ef4444', fontSize: '0.8rem', textAlign: 'center', marginTop: '1rem' }}>
                                        Insufficient {tokenSymbol} balance
                                    </p>
                                )}
                            </div>

                            {/* FLOW DIAGRAM at bottom */}
                            <div className="card" style={{ padding: '1.5rem' }}>
                                <div className="font-mono text-xs text-dim mb-4">// CONTINUOUS LOOP</div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                                    {['Buy POLL', 'Create Proposal', 'Voters Stake', 'Finalize', 'Earn POLL', 'Redeem SOL', 'Repeat 🔥'].map((step, i, arr) => (
                                        <React.Fragment key={i}>
                                            <div className="badge" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid #222', padding: '0.5rem 0.75rem', fontSize: '0.7rem' }}>
                                                {step}
                                            </div>
                                            {i < arr.length - 1 && <ArrowRight size={14} className="text-dim" />}
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                    {activeTab === 'game' && (
                        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            {/* GAME HEADER & JOIN BY ID */}
                            <div className="card" style={{ padding: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, rgba(20,20,20,1) 0%, rgba(30,30,30,1) 100%)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ color: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '0.6rem', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                                        <Coins size={28} />
                                    </div>
                                    <div>
                                        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>Flip a Coin</h2>
                                        <p className="text-dim text-sm font-mono">// 2-Player Token Battle</p>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <input 
                                        type="text" 
                                        placeholder="Enter Game ID..."
                                        value={gameIdInput}
                                        onChange={(e) => setGameIdInput(e.target.value)}
                                        style={{ backgroundColor: '#000', border: '1px solid var(--card-border)', borderRadius: '8px', padding: '0.75rem 1rem', color: 'white', width: '160px', fontFamily: 'var(--font-mono)' }}
                                    />
                                    <button 
                                        onClick={() => {
                                            const pool = gamePools.find(p => p.account.poolId.toNumber() === parseInt(gameIdInput));
                                            if (pool) handleJoinGamePool(pool);
                                            else appendLog("Game ID not found!", true);
                                        }}
                                        disabled={isJoiningPool || !gameIdInput}
                                        className="btn btn-secondary"
                                        style={{ padding: '0 1.5rem', fontWeight: 700 }}
                                    >
                                        JOIN
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '2rem' }}>
                                {/* CREATE POOL SECTION */}
                                <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Create New Pool</h3>
                                    
                                    <div>
                                        <label className="text-dim font-mono text-xs uppercase mb-2 block">Bet Amount ({tokenSymbol})</label>
                                        <input 
                                            type="number" 
                                            value={betAmount}
                                            onChange={(e) => setBetAmount(Number(e.target.value))}
                                            style={{ width: '100%', backgroundColor: '#0a0a0a', border: '1px solid var(--card-border)', borderRadius: '8px', padding: '1rem', fontSize: '1.25rem', color: 'white', fontWeight: 700 }}
                                        />
                                    </div>

                                    <div>
                                        <label className="text-dim font-mono text-xs uppercase mb-2 block">Select Side</label>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                            <button 
                                                onClick={() => setUserChoice(0)}
                                                style={{ 
                                                    padding: '1.5rem', 
                                                    borderRadius: '12px', 
                                                    border: userChoice === 0 ? '2px solid #f59e0b' : '1px solid var(--card-border)',
                                                    backgroundColor: userChoice === 0 ? 'rgba(245, 158, 11, 0.1)' : '#0a0a0a',
                                                    color: userChoice === 0 ? 'white' : 'var(--text-dim)',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    fontWeight: 800
                                                }}
                                            >
                                                HEADS
                                            </button>
                                            <button 
                                                onClick={() => setUserChoice(1)}
                                                style={{ 
                                                    padding: '1.5rem', 
                                                    borderRadius: '12px', 
                                                    border: userChoice === 1 ? '2px solid #f59e0b' : '1px solid var(--card-border)',
                                                    backgroundColor: userChoice === 1 ? 'rgba(245, 158, 11, 0.1)' : '#0a0a0a',
                                                    color: userChoice === 1 ? 'white' : 'var(--text-dim)',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    fontWeight: 800
                                                }}
                                            >
                                                TAILS
                                            </button>
                                        </div>
                                    </div>

                                    <button 
                                        onClick={handleCreateGamePool}
                                        disabled={isCreatingPool || !anchorWallet || pollBalance < betAmount}
                                        className="btn btn-primary"
                                        style={{ padding: '1.25rem', fontSize: '1rem', fontWeight: 800, marginTop: '1rem' }}
                                    >
                                        {isCreatingPool ? 'CREATING...' : `CREATE POOL (${betAmount} ${tokenSymbol})`}
                                    </button>
                                </div>

                                {/* ACTIVE POOLS SECTION */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0.5rem' }}>
                                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Open Game Pools</h3>
                                        <span className="text-dim font-mono text-xs">{gamePools.filter(g => g.account.status === 0).length} Available</span>
                                    </div>
                                    
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '500px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                                        {gamePools.filter(g => g.account.status === 0).length === 0 ? (
                                            <div className="card" style={{ padding: '3rem', textAlign: 'center', borderStyle: 'dashed' }}>
                                                <p className="text-dim text-sm italic">No open pools. Start one!</p>
                                            </div>
                                        ) : (
                                            gamePools.filter(g => g.account.status === 0).map((g, i) => (
                                                <div key={i} className="card animate-fade-in" style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>GAME ID: #{g.account.poolId.toString()}</div>
                                                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'white' }}>{g.account.amount.toNumber() / (10 ** decimals)} {tokenSymbol}</div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--accent-green)', fontWeight: 600 }}>Creator: {g.account.creator.toBase58().substring(0, 6)}...</div>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                        <div style={{ textAlign: 'right', fontSize: '0.8rem' }}>
                                                            <div className="text-dim">Opponent gets</div>
                                                            <div style={{ color: '#f59e0b', fontWeight: 700 }}>{g.account.creatorChoice === 0 ? 'TAILS' : 'HEADS'}</div>
                                                        </div>
                                                        <button 
                                                            disabled={isJoiningPool || (anchorWallet && g.account.creator.equals(anchorWallet.publicKey))}
                                                            onClick={() => handleJoinGamePool(g)}
                                                            className="btn btn-secondary"
                                                            style={{ 
                                                                padding: '0.75rem 1.25rem', 
                                                                fontSize: '0.8rem', 
                                                                backgroundColor: anchorWallet && g.account.creator.equals(anchorWallet.publicKey) ? '#111' : 'var(--accent-green-dim)',
                                                                border: '1px solid var(--accent-green-border)'
                                                            }}
                                                        >
                                                            {anchorWallet && g.account.creator.equals(anchorWallet.publicKey) ? 'OWN POOL' : 'JOIN & FLIP'}
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* FLIP ANIMATION OVERLAY */}
                            {(isFlipping || lastGameResult) && (
                                <div style={{
                                    position: 'fixed',
                                    inset: 0,
                                    backgroundColor: 'rgba(0,0,0,0.9)',
                                    zIndex: 2000,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backdropFilter: 'blur(10px)',
                                    animation: 'fadeIn 0.3s ease'
                                }}>
                                    {isFlipping ? (
                                        <div style={{ textAlign: 'center' }}>
                                            <div className="coin-spin" style={{
                                                width: '120px',
                                                height: '120px',
                                                backgroundColor: '#f59e0b',
                                                borderRadius: '50%',
                                                border: '6px solid #b45309',
                                                boxShadow: '0 0 50px rgba(245, 158, 11, 0.4)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '3rem',
                                                fontWeight: 900,
                                                color: '#b45309',
                                                marginBottom: '2rem'
                                            }}>
                                                $
                                            </div>
                                            <h2 className="animate-pulse" style={{ fontSize: '2rem', fontWeight: 800 }}>FLIPPING...</h2>
                                            <p className="font-mono text-dim mt-2">// Good Luck!</p>
                                        </div>
                                    ) : (
                                        <div className="animate-fade-in" style={{ textAlign: 'center', transform: 'scale(1.2)' }}>
                                            <div style={{
                                                width: '100px',
                                                height: '100px',
                                                borderRadius: '50%',
                                                backgroundColor: lastGameResult.win ? 'var(--accent-green)' : '#ef4444',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '2.5rem',
                                                marginBottom: '1.5rem',
                                                marginInline: 'auto',
                                                boxShadow: lastGameResult.win ? '0 0 40px var(--accent-green-dim)' : '0 0 40px rgba(239, 68, 68, 0.2)'
                                            }}>
                                                {lastGameResult.win ? '🏆' : '💀'}
                                            </div>
                                            <h2 style={{ fontSize: '2.5rem', fontWeight: 900, color: lastGameResult.win ? 'var(--accent-green)' : '#ef4444' }}>
                                                {lastGameResult.win ? 'YOU WON!' : 'YOU LOST!'}
                                            </h2>
                                            <p style={{ fontSize: '1.25rem', marginTop: '1rem', fontWeight: 600 }}>
                                                Result: <span style={{ color: '#f59e0b' }}>{lastGameResult.result === 0 ? 'HEADS' : 'TAILS'}</span>
                                            </p>
                                            {lastGameResult.win && (
                                                <div style={{ fontSize: '1.25rem', marginTop: '0.5rem', color: 'var(--accent-green)' }}>
                                                    + {lastGameResult.reward.toFixed(2)} {tokenSymbol}
                                                </div>
                                            )}
                                            <button 
                                                onClick={() => setLastGameResult(null)}
                                                className="btn btn-secondary"
                                                style={{ marginTop: '2.5rem', padding: '0.75rem 3rem' }}
                                            >
                                                CLOSE
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default UserApp;


