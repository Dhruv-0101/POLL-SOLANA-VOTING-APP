import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, Navigate } from 'react-router-dom';
import { 
  Shield, LogOut, Coins, BarChart3, Fingerprint, Settings, Zap, ArrowRight, 
  CheckCircle, Upload, Image, RotateCcw
} from 'lucide-react';

/* Solana / Anchor Imports */
import { useAnchorWallet, useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import idl from '../idl/polldotsol.json';

import { logoutAdmin } from '../store/appSlice';

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

const AdminDashboard = () => {
  const { isAdminAuthenticated } = useSelector(state => state.app);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const anchorWallet = useAnchorWallet();

  const [activeStep, setActiveStep] = useState(() => Number(localStorage.getItem('activeStep')) || 1);
  
  const updateActiveStep = (step) => {
    setActiveStep(step);
    localStorage.setItem('activeStep', step);
  };

  // Prevent user from swiping back / clicking the browser back button
  useEffect(() => {
    // Push the current state to the history stack
    window.history.pushState(null, document.title, window.location.href);
    
    // When the user tries to go back, the popstate event is triggered
    const handlePopState = (event) => {
      // Push the state again so they stay on the current page
      window.history.pushState(null, document.title, window.location.href);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const [decimals, setDecimals] = useState(6);
  const [isCreating, setIsCreating] = useState(false);

  const [isTokenCreated, setIsTokenCreated] = useState(() => localStorage.getItem('isTokenCreated') === 'true');
  const [mintAddress, setMintAddress] = useState(() => localStorage.getItem('mintAddress') || '');
  
  const [isInitializing, setIsInitializing] = useState(false);
  const [isTreasuryInitialized, setIsTreasuryInitialized] = useState(() => localStorage.getItem('isTreasuryInit') === 'true');
  const [treasuryAta, setTreasuryAta] = useState(() => localStorage.getItem('treasuryAta') || '');
  const [solVault, setSolVault] = useState(() => localStorage.getItem('solVault') || '');
  
  const [tokenName, setTokenName] = useState(() => localStorage.getItem('tokenName') || 'PollToken');
  const [tokenSymbol, setTokenSymbol] = useState(() => localStorage.getItem('tokenSymbol') || 'POLL');
  const [isStoringMetadata, setIsStoringMetadata] = useState(false);
  const [isMetadataStored, setIsMetadataStored] = useState(() => localStorage.getItem('isMetadataStored') === 'true');
  
  // Step 4 Minting State
  const [mintAmount, setMintAmount] = useState(1000000);
  const [isMinting, setIsMinting] = useState(false);
  const [totalMinted, setTotalMinted] = useState(() => Number(localStorage.getItem('totalMinted')) || 0);

  // Step 5 Settings State
  const [tokenPrice, setTokenPrice] = useState(() => Number(localStorage.getItem('tokenPrice')) || 0.1);
  const [proposalCost, setProposalCost] = useState(() => Number(localStorage.getItem('proposalCost')) || 10);
  const [voteCost, setVoteCost] = useState(() => Number(localStorage.getItem('voteCost')) || 1);
  const [feePercentage, setFeePercentage] = useState(() => Number(localStorage.getItem('feePercentage')) || 10);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSettingsSet, setIsSettingsSet] = useState(() => localStorage.getItem('isSettingsSet') === 'true');

  // Vault Management State
  const [vaultBalance, setVaultBalance] = useState(0);
  const [withdrawAmount, setWithdrawAmount] = useState(0);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);

  // Initialize logs from localStorage for persistence
  const [logs, setLogs] = useState(() => {
    const saved = localStorage.getItem('adminLogs');
    return saved ? JSON.parse(saved) : [];
  });

  const appendLog = (msg, error = false) => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: true });
    setLogs(prev => {
      const newLogs = [...prev, { time, message: msg, error }];
      localStorage.setItem('adminLogs', JSON.stringify(newLogs));
      return newLogs;
    });
  };

  // Check the actual Blockchain state on connection
  useEffect(() => {
    if (!anchorWallet || !connection) return;
    const fetchOnChainState = async () => {
      if (!anchorWallet) return;
      
      localStorage.setItem('adminAddress', anchorWallet.publicKey.toBase58());
      
      try {
        const provider = new AnchorProvider(connection, anchorWallet, { preflightCommitment: "processed" });
        const program = new Program(idl, provider);
        
        const [treasuryPda] = PublicKey.findProgramAddressSync(
            [new TextEncoder().encode("treasury"), anchorWallet.publicKey.toBytes()],
            program.programId
        );
        
        // Fetch Treasury Data
        const treasuryAccount = await program.account.treasury.fetch(treasuryPda);
        
        // Update Local & State if fetched successfully
        setIsTokenCreated(true);
        localStorage.setItem('isTokenCreated', 'true');
        
        const fetchedMint = treasuryAccount.mint.toBase58();
        setMintAddress(fetchedMint);
        localStorage.setItem('mintAddress', fetchedMint);
        
        if (treasuryAccount.isInitialized) {
            setIsTreasuryInitialized(true);
            localStorage.setItem('isTreasuryInit', 'true');
            
            const [mintPda] = PublicKey.findProgramAddressSync(
                [new TextEncoder().encode("mint"), anchorWallet.publicKey.toBytes()],
                program.programId
            );
            const [vaultPda] = PublicKey.findProgramAddressSync(
                [new TextEncoder().encode("vault"), treasuryPda.toBytes()],
                program.programId
            );
            const ata = getAssociatedTokenAddressSync(mintPda, treasuryPda, true);
            
            setTreasuryAta(ata.toBase58());
            localStorage.setItem('treasuryAta', ata.toBase58());
            
            setSolVault(vaultPda.toBase58());
            localStorage.setItem('solVault', vaultPda.toBase58());

            // Check if Metadata account exists
            const TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
            const [metadataAccount] = PublicKey.findProgramAddressSync(
              [
                Buffer.from("metadata"),
                TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                mintPda.toBuffer(),
              ],
              TOKEN_METADATA_PROGRAM_ID
            );
            
            const metadataInfo = await connection.getAccountInfo(metadataAccount);
            if (metadataInfo) {
                setIsMetadataStored(true);
                localStorage.setItem('isMetadataStored', 'true');
                
                try {
                    // Metaplex Layout: Key(1) + Auth(32) + Mint(32) = 65
                    // Name: 4 (len) + 32 (data)
                    // Symbol: 4 (len) + 10 (data)
                    const data = metadataInfo.data;
                    const name = data.slice(69, 69+32).toString('utf8').replace(/\u0000/g, '').trim();
                    const symbol = data.slice(105, 105+10).toString('utf8').replace(/\u0000/g, '').trim();
                    const uriLen = data.readUInt32LE(115);
                    const uri = data.slice(119, 119 + uriLen).toString('utf8').replace(/\u0000/g, '').trim();
                    
                    if (name) {
                        setTokenName(name);
                        localStorage.setItem('tokenName', name);
                    }
                    if (symbol) {
                        setTokenSymbol(symbol);
                        localStorage.setItem('tokenSymbol', symbol);
                    }
                    if (uri) {
                        setTokenUri(uri);
                        localStorage.setItem('tokenUri', uri);
                    }
                } catch (parseErr) {
                    console.warn("Could not decode metadata buffer:", parseErr);
                }
            }

            // Fetch Token Balance for Minted Status
            try {
               const balanceInfo = await connection.getTokenAccountBalance(ata);
               if (balanceInfo && balanceInfo.value) {
                   const balance = balanceInfo.value.uiAmount;
                   setTotalMinted(balance);
                   localStorage.setItem('totalMinted', balance);
               }
            } catch (balErr) {
                // ATA might not exist yet if treasury not fully init, that's fine
            }

            // Fetch Platform Settings
            if (treasuryAccount.tokenPrice.toNumber() > 0) {
                const fetchedPrice = treasuryAccount.tokenPrice.toNumber() / 1e9; // SOL is 9 decimals
                const fetchedProposal = treasuryAccount.proposalCost.toNumber() / (10 ** decimals);
                const fetchedVote = treasuryAccount.voteCost.toNumber() / (10 ** decimals);
                const fetchedFee = treasuryAccount.feeBasisPoints / 100;

                setTokenPrice(fetchedPrice);
                setProposalCost(fetchedProposal);
                setVoteCost(fetchedVote);
                setFeePercentage(fetchedFee);
                setIsSettingsSet(true);
                localStorage.setItem('isSettingsSet', 'true');
                localStorage.setItem('tokenPrice', fetchedPrice);
                localStorage.setItem('proposalCost', fetchedProposal);
                localStorage.setItem('voteCost', fetchedVote);
                localStorage.setItem('feePercentage', fetchedFee);
            }

            // Fetch Vault SOL Balance
            if (vaultPda) {
                const vaultBal = await connection.getBalance(vaultPda);
                setVaultBalance(vaultBal / 1e9);
            }
        }
      } catch (err) {
        // If the account doesn't exist OR network failed. Keep the localStorage cache intact natively.
        console.warn("Could not fetch Treasury (possibly rate limited or fresh wallet):", err);
      }
    };
    
    fetchOnChainState();
  }, [anchorWallet, connection]);

  // Public wrapper for manual Refresh
  const manualRefresh = async () => {
      if (!anchorWallet || isRefreshing) return;
      setIsRefreshing(true);
      appendLog('Refreshing on-chain data...');
      
      try {
        const provider = new AnchorProvider(connection, anchorWallet, { preflightCommitment: "confirmed" });
        const program = new Program(idl, provider);
        const adminPubkey = anchorWallet.publicKey;
        
        const [treasuryPda] = PublicKey.findProgramAddressSync(
            [new TextEncoder().encode("treasury"), adminPubkey.toBytes()],
            program.programId
        );
        
        const [mintPda] = PublicKey.findProgramAddressSync(
            [new TextEncoder().encode("mint"), adminPubkey.toBytes()],
            program.programId
        );
        
        const treasuryAccount = await program.account.treasury.fetch(treasuryPda);
        const [vaultPda] = PublicKey.findProgramAddressSync(
            [new TextEncoder().encode("vault"), treasuryPda.toBytes()],
            program.programId
        );
        const ata = getAssociatedTokenAddressSync(mintPda, treasuryPda, true);
        
        // Fetch SOL Vault
        const vaultBal = await connection.getBalance(vaultPda, "confirmed");
        setVaultBalance(vaultBal / 1e9);

        // Fetch Token Balance
        const balanceInfo = await connection.getTokenAccountBalance(ata);
        if (balanceInfo && balanceInfo.value) {
           const bal = balanceInfo.value.uiAmount;
           setTotalMinted(bal);
           localStorage.setItem('totalMinted', bal);
        }

        // Fetch Platform Settings
        if (treasuryAccount.tokenPrice.toNumber() > 0) {
            setTokenPrice(treasuryAccount.tokenPrice.toNumber() / 1e9);
            setProposalCost(treasuryAccount.proposalCost.toNumber() / (10 ** decimals));
            setVoteCost(treasuryAccount.voteCost.toNumber() / (10 ** decimals));
            setIsSettingsSet(true);
        }
        
        appendLog('Data updated successfully!');
      } catch (err) {
        console.warn("Refresh failed:", err);
      } finally {
        setIsRefreshing(false);
      }
  };

  // Program Call to Create SPL Token Mint
  const handleCreateToken = async () => {
    if (!anchorWallet) {
      appendLog('Error: Wallet not connected', true);
      alert('Please connect your admin wallet first!');
      return;
    }
    
    setIsCreating(true);
    appendLog(`Preparing to create token with ${decimals} decimals...`);
    
    try {
      const provider = new AnchorProvider(connection, anchorWallet, { preflightCommitment: "processed" });
      const program = new Program(idl, provider);
      const adminPubkey = anchorWallet.publicKey;
      
      // Calculate Treasury PDA
      const [treasuryPda] = PublicKey.findProgramAddressSync(
          [new TextEncoder().encode("treasury"), adminPubkey.toBytes()],
          program.programId
      );
      appendLog(`Derived Treasury PDA: ${treasuryPda.toBase58()}`);
      
      // Calculate Mint PDA (NOTE: Seeds match contract exactly: b"mint", admin)
      const [mintPda] = PublicKey.findProgramAddressSync(
          [new TextEncoder().encode("mint"), adminPubkey.toBytes()],
          program.programId
      );
      appendLog(`Derived Mint PDA: ${mintPda.toBase58()}`);
      
      // Execute the RPC Call
      const txSignature = await program.methods
          .createToken(decimals)
          .accounts({
              admin: adminPubkey,
              treasury: treasuryPda,
              mint: mintPda,
              tokenProgram: TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
              rent: SYSVAR_RENT_PUBKEY,
          })
          .rpc();
          
      appendLog(`SPL Token Mint created successfully! Tx: ${txSignature.substring(0,8)}...`);
      const mintAddr = mintPda.toBase58();
      setMintAddress(mintAddr);
      setIsTokenCreated(true);
      
      // Update Persistent Storage
      localStorage.setItem('isTokenCreated', 'true');
      localStorage.setItem('mintAddress', mintAddr);
      updateActiveStep(2); // Auto move to next step logic can be here too
      
    } catch (err) {
      console.error("Create Token Error:", err);
      // Try to parse friendly error from Anchor, otherwise raw message
      let errMsg = err.message;
      if (err.msg) errMsg = err.msg; 
      appendLog(`Transaction Failed: ${errMsg}`, true);
    } finally {
      setIsCreating(false);
    }
  };

  const handleInitTreasury = async () => {
    if (!anchorWallet) {
      alert("Please connect your Admin Wallet to perform this action!");
      return;
    }
    if (!isTokenCreated) return;
    
    setIsInitializing(true);
    appendLog(`Preparing to Initialize Treasury and Vault...`);
    
    try {
      const provider = new AnchorProvider(connection, anchorWallet, { preflightCommitment: "processed" });
      const program = new Program(idl, provider);
      const adminPubkey = anchorWallet.publicKey;
      
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

      // Derive the Associated Token Account correctly using Spl-Token package
      const treasuryTokenAccount = getAssociatedTokenAddressSync(
          mintPda,
          treasuryPda,
          true // allowOwnerOffCurve = true
      );
      
      appendLog(`Derived ATA: ${treasuryTokenAccount.toBase58()}`);
      appendLog(`Derived Vault: ${vaultPda.toBase58()}`);

      const txSignature = await program.methods
          .initializeTreasury()
          .accounts({
              admin: adminPubkey,
              treasury: treasuryPda,
              mint: mintPda,
              treasuryTokenAccount: treasuryTokenAccount,
              vault: vaultPda,
              systemProgram: SystemProgram.programId,
              tokenProgram: TOKEN_PROGRAM_ID,
              associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .rpc();
          
      appendLog(`Treasury Token Account + SOL Vault created! Tx: ${txSignature.substring(0,8)}...`);
      setIsTreasuryInitialized(true);
      const ataAddr = treasuryTokenAccount.toBase58();
      const vaultAddr = vaultPda.toBase58();
      setTreasuryAta(ataAddr);
      setSolVault(vaultAddr);
      
      // Update Persistent Storage
      localStorage.setItem('isTreasuryInit', 'true');
      localStorage.setItem('treasuryAta', ataAddr);
      localStorage.setItem('solVault', vaultAddr);
      updateActiveStep(3); // Move to next step (Metadata)
      
    } catch (err) {
      console.error("Init Treasury Error:", err);
      let errMsg = err.message;
      if (err.msg) errMsg = err.msg;
      appendLog(`Transaction Failed: ${errMsg}`, true);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleSetMetadata = async () => {
    if (!anchorWallet) {
      alert("Please connect your Admin Wallet to perform this action!");
      return;
    }
    if (!isTokenCreated) return;
    
    setIsStoringMetadata(true);
    appendLog(`Storing Metadata for ${tokenName} (${tokenSymbol})...`);
    
    try {
      const provider = new AnchorProvider(connection, anchorWallet, { preflightCommitment: "processed" });
      const program = new Program(idl, provider);
      const adminPubkey = anchorWallet.publicKey;
      
      const [mintPda] = PublicKey.findProgramAddressSync(
          [new TextEncoder().encode("mint"), adminPubkey.toBytes()],
          program.programId
      );

      const [treasuryPda] = PublicKey.findProgramAddressSync(
          [new TextEncoder().encode("treasury"), adminPubkey.toBytes()],
          program.programId
      );

      // Metaplex Metadata Program ID (metaqbxxUf32SCnu76pt77u2wwDGvEuySqr1Rn5HZV4)
      // Note: Some devnet versions use different IDs, but we use the standard or the one from IDL.
      // IDL says metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s
      const TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

      const [metadataAccount] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          mintPda.toBuffer(),
        ],
        TOKEN_METADATA_PROGRAM_ID
      );
      
      appendLog(`Derived Metadata Account: ${metadataAccount.toBase58()}`);

      const txSignature = await program.methods
          .setTokenMetadata(tokenName, tokenSymbol)
          .accounts({
              admin: adminPubkey,
              treasury: treasuryPda,
              mint: mintPda,
              metadataAccount: metadataAccount,
              tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
              rent: SYSVAR_RENT_PUBKEY,
          })
          .rpc();
          
      appendLog(`Token metadata stored: ${tokenName} (${tokenSymbol})! Tx: ${txSignature.substring(0,8)}...`);
      setIsMetadataStored(true);
      
      // Update Persistent Storage
      localStorage.setItem('isMetadataStored', 'true');
      localStorage.setItem('tokenName', tokenName);
      localStorage.setItem('tokenSymbol', tokenSymbol);
      
      updateActiveStep(4); // Move to next step (Minting)
      
    } catch (err) {
      console.error("Set Metadata Error:", err);
      let errMsg = err.message;
      if (err.msg) errMsg = err.msg;
      appendLog(`Transaction Failed: ${errMsg}`, true);
    } finally {
      setIsStoringMetadata(false);
    }
  };

  const handleMintTokens = async () => {
    if (!anchorWallet) {
      alert("Please connect your Admin Wallet to perform this action!");
      return;
    }
    if (!isTreasuryInitialized) return;
    
    setIsMinting(true);
    appendLog(`Minting ${mintAmount.toLocaleString()} ${tokenSymbol} to Treasury...`);
    
    try {
      const provider = new AnchorProvider(connection, anchorWallet, { preflightCommitment: "confirmed" });
      const program = new Program(idl, provider);
      const adminPubkey = anchorWallet.publicKey;
      
      const [mintPda] = PublicKey.findProgramAddressSync(
          [new TextEncoder().encode("mint"), adminPubkey.toBytes()],
          program.programId
      );

      const [treasuryPda] = PublicKey.findProgramAddressSync(
          [new TextEncoder().encode("treasury"), adminPubkey.toBytes()],
          program.programId
      );

      const treasuryTokenAccount = getAssociatedTokenAddressSync(mintPda, treasuryPda, true);
      
      const amountBN = new BN(mintAmount).mul(new BN(10).pow(new BN(decimals)));

      const txSignature = await program.methods
          .mintTokens(amountBN)
          .accounts({
              admin: adminPubkey,
              treasury: treasuryPda,
              mint: mintPda,
              treasuryTokenAccount: treasuryTokenAccount,
              tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
          
      // Success Logic
      appendLog(`Successfully minted ${mintAmount.toLocaleString()} tokens! Tx: ${txSignature.substring(0,8)}...`);
      
      // Fetch new balance IMMEDIATELY from blockchain (Fast Update)
      try {
        const balInfo = await connection.getTokenAccountBalance(treasuryTokenAccount, "confirmed");
        if (balInfo && balInfo.value) {
           const newBalance = balInfo.value.uiAmount;
           setTotalMinted(newBalance);
           localStorage.setItem('totalMinted', newBalance);
        }
      } catch (e) {
          // Fallback if indexer is slow
          const manualTotal = totalMinted + mintAmount;
          setTotalMinted(manualTotal);
      }
      
      // Re-fetch everything else in background
      setTimeout(manualRefresh, 2000);

      // If first time minting significant amount, maybe move to next step
      if (mintAmount > 0) {
          updateActiveStep(5);
      }
      
    } catch (err) {
      console.error("Mint Error:", err);
      let errMsg = err.message;
      if (err.msg) errMsg = err.msg;
      appendLog(`Mint Failed: ${errMsg}`, true);
    } finally {
      setIsMinting(false);
    }
  };

  const handleSaveSettings = async () => {
      if (!anchorWallet) {
        alert("Please connect your Admin Wallet to perform this action!");
        return;
      }
      if (!isTreasuryInitialized) return;
      
      setIsSavingSettings(true);
      appendLog(`Saving Platform Settings...`);
      
      try {
        const provider = new AnchorProvider(connection, anchorWallet, { preflightCommitment: "confirmed" });
        const program = new Program(idl, provider);
        const adminPubkey = anchorWallet.publicKey;
        
        const [treasuryPda] = PublicKey.findProgramAddressSync(
            [new TextEncoder().encode("treasury"), adminPubkey.toBytes()],
            program.programId
        );
        
        // Convert to on-chain units
        const priceBN = new BN(tokenPrice * 1e9); // SOL to Lamports
        const propCostBN = new BN(proposalCost).mul(new BN(10).pow(new BN(decimals)));
        const voteCostBN = new BN(voteCost).mul(new BN(10).pow(new BN(decimals)));
        const feeBP = Math.round(feePercentage * 100);

        const txSignature = await program.methods
            .updatePlatformSettings(priceBN, propCostBN, voteCostBN, feeBP)
            .accounts({
                admin: adminPubkey,
                treasury: treasuryPda,
            })
            .rpc();
            
        setIsSettingsSet(true);
        localStorage.setItem('isSettingsSet', 'true');
        localStorage.setItem('tokenPrice', tokenPrice);
        localStorage.setItem('proposalCost', proposalCost);
        localStorage.setItem('voteCost', voteCost);
        localStorage.setItem('feePercentage', feePercentage);

        appendLog(`Platform settings saved: ${tokenPrice} SOL/token, ${feePercentage}% fee! Tx: ${txSignature.substring(0,8)}...`);
        
        // Re-fetch
        setTimeout(manualRefresh, 1000);
        
      } catch (err) {
        console.error("Save Settings Error:", err);
        let errMsg = err.message;
        if (err.msg) errMsg = err.msg;
        appendLog(`Settings Failed: ${errMsg}`, true);
      } finally {
        setIsSavingSettings(false);
      }
  };

  const handleWithdrawFees = async () => {
    if (!anchorWallet) {
      alert("Please connect your Admin Wallet to perform this action!");
      return;
    }
    if (!isTreasuryInitialized || withdrawAmount <= 0) return;
    
    setIsWithdrawing(true);
    appendLog(`Withdrawing ${withdrawAmount} SOL...`);
    
    try {
      const provider = new AnchorProvider(connection, anchorWallet, { preflightCommitment: "confirmed" });
      const program = new Program(idl, provider);
      const adminPubkey = anchorWallet.publicKey;
      
      const [treasuryPda] = PublicKey.findProgramAddressSync(
          [new TextEncoder().encode("treasury"), adminPubkey.toBytes()],
          program.programId
      );

      const [vaultPda] = PublicKey.findProgramAddressSync(
          [new TextEncoder().encode("vault"), treasuryPda.toBytes()],
          program.programId
      );
      
      const amountBN = new BN(withdrawAmount * 1e9);

      const txSignature = await program.methods
          .withdrawFees(amountBN)
          .accounts({
              admin: adminPubkey,
              treasury: treasuryPda,
              vault: vaultPda,
          })
          .rpc();
          
      // Refresh vault balance IMMEDIATELY (Fast Update)
      const newBal = await connection.getBalance(vaultPda, "confirmed");
      setVaultBalance(newBal / 1e9);

      appendLog(`Successfully withdrawn ${withdrawAmount} SOL! Tx: ${txSignature.substring(0,8)}...`);
      setWithdrawAmount(0);

      // Full refresh in background
      setTimeout(manualRefresh, 2000);
      
    } catch (err) {
      console.error("Withdraw Error:", err);
      appendLog(`Withdraw Failed: ${err.message}`, true);
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Shorten wallet address helper
  const formatAddress = (address) => {
    if (!address) return '';
    const addrStr = address.toString();
    return `${addrStr.slice(0, 4)}...${addrStr.slice(-4)}`;
  };

  // Logout handler
  const handleLogout = () => {
    dispatch(logoutAdmin());
    navigate('/');
  };

  // Redirect if not authenticated
  if (!isAdminAuthenticated) {
    return <Navigate to="/admin" />;
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-color)',
      color: 'var(--text-main)',
      display: 'flex',
      flexDirection: 'column',
      backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 4px, rgba(255, 255, 255, 0.015) 4px, rgba(255, 255, 255, 0.015) 5px)',
    }}>
      
      {/* TOP HEADER BAR */}
      <header style={{
        padding: '1.5rem',
        borderBottom: '1px solid var(--card-border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 10
      }}>
        {/* Left Side: Logo & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            backgroundColor: 'var(--accent-green-dim)',
            border: '1px solid var(--accent-green-border)',
            padding: '0.4rem',
            borderRadius: '0.375rem',
            color: 'var(--accent-green)',
            display: 'flex',
            alignItems: 'center'
          }}>
            <Shield size={20} />
          </div>
          <span style={{ fontWeight: 800, letterSpacing: '0.05em' }}>ADMIN DASHBOARD</span>
          <span style={{
            fontSize: '0.65rem',
            fontWeight: 700,
            color: 'var(--accent-green)',
            border: '1px solid var(--accent-green-border)',
            backgroundColor: 'var(--accent-green-dim)',
            padding: '0.2rem 0.5rem',
            borderRadius: '4px',
            letterSpacing: '0.1em'
          }}>
            PRIVILEGED
          </span>
        </div>

        {/* Right Side: Wallet & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          
          {/* Treasury Balances Display */}
          <div style={{ display: 'flex', gap: '1rem', borderRight: '1px solid var(--card-border)', paddingRight: '1.5rem' }}>
              <div style={{ textAlign: 'right' }}>
                 <div className="font-mono text-dim" style={{ fontSize: '0.6rem' }}>TOKEN RESERVE</div>
                 <div className="font-mono" style={{ fontSize: '0.9rem', color: 'var(--accent-green)', fontWeight: 700 }}>{totalMinted.toLocaleString()} {tokenSymbol}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                 <div className="font-mono text-dim" style={{ fontSize: '0.6rem' }}>VAULT BALANCE</div>
                 <div className="font-mono" style={{ fontSize: '0.9rem', color: 'white', fontWeight: 700 }}>{vaultBalance.toFixed(3)} SOL</div>
              </div>
              <button 
                onClick={manualRefresh}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: isRefreshing ? 'var(--accent-green)' : 'var(--text-dim)', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  padding: '0.25rem',
                  transition: 'all 0.3s ease'
                }}
                disabled={isRefreshing}
                title="Refresh from Blockchain"
              >
                <RotateCcw 
                  size={14} 
                  className={isRefreshing ? "spin-animation" : ""} 
                  style={{ 
                    animation: isRefreshing ? 'spin 1s linear infinite' : 'none' 
                  }}
                />
              </button>
          </div>
          
          <div className="admin-wallet-btn-container" style={{ position: 'relative', zIndex: 50 }}>
            <WalletMultiButton 
               style={{ 
                 height: 'auto', 
                 padding: '0.6rem 1.25rem',
                 backgroundColor: '#111', 
                 border: '1px solid var(--card-border)',
                 fontSize: '0.875rem',
                 fontFamily: 'var(--font-mono)',
                 borderRadius: '0.375rem',
                 transition: 'all 0.2s'
               }}
            />
          </div>

          <button 
            onClick={handleLogout}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'var(--text-dim)', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.875rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              transition: 'color 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.color = '#ef4444'}
            onMouseLeave={(e) => e.target.style.color = 'var(--text-dim)'}
          >
            <LogOut size={16} /> LOGOUT
          </button>
        </div>
      </header>


      {/* MAIN LAYOUT */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(280px, 320px) 1fr',
        gap: '2rem',
        padding: '2rem 2%',
        flex: 1
      }}>
        
        {/* LEFT SIDEBAR */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Setup Steps Card */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div className="font-mono text-sm text-dim" style={{ marginBottom: '1.5rem' }}>
              // SETUP STEPS
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              
              {/* Step 1 */}
              <button 
                onClick={() => updateActiveStep(1)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem',
                  borderRadius: '0.5rem',
                  border: activeStep === 1 ? '1px solid var(--accent-green-border)' : '1px solid transparent',
                  backgroundColor: activeStep === 1 ? 'var(--accent-green-dim)' : 'transparent',
                  color: activeStep === 1 ? 'var(--accent-green)' : 'var(--text-dim)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.9rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {isTokenCreated ? <CheckCircle size={18} color="var(--accent-green)" /> : <Coins size={18} />}
                  <span>01. Create Token</span>
                </div>
                {activeStep === 1 && <ArrowRight size={16} />}
              </button>

              {/* Step 2 */}
              <button 
                onClick={() => updateActiveStep(2)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem',
                  borderRadius: '0.5rem',
                  border: activeStep === 2 ? '1px solid var(--accent-green-border)' : '1px solid transparent',
                  backgroundColor: activeStep === 2 ? 'var(--accent-green-dim)' : 'transparent',
                  color: activeStep === 2 ? 'var(--accent-green)' : 'var(--text-dim)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.9rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {isTreasuryInitialized ? <CheckCircle size={18} color="var(--accent-green)" /> : <BarChart3 size={18} />}
                  <span>02. Init Treasury</span>
                </div>
                {activeStep === 2 && <ArrowRight size={16} />}
              </button>

              {/* Step 3 */}
              <button 
                onClick={() => updateActiveStep(3)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem',
                  borderRadius: '0.5rem',
                  border: activeStep === 3 ? '1px solid var(--accent-green-border)' : '1px solid transparent',
                  backgroundColor: activeStep === 3 ? 'var(--accent-green-dim)' : 'transparent',
                  color: activeStep === 3 ? 'var(--accent-green)' : 'var(--text-dim)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.9rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {isMetadataStored ? <CheckCircle size={18} color="var(--accent-green)" /> : <Fingerprint size={18} />}
                  <span>03. Metadata</span>
                </div>
                {activeStep === 3 && <ArrowRight size={16} />}
              </button>

              {/* Step 4 */}
              <button 
                onClick={() => updateActiveStep(4)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem',
                  borderRadius: '0.5rem',
                  border: activeStep === 4 ? '1px solid var(--accent-green-border)' : '1px solid transparent',
                  backgroundColor: activeStep === 4 ? 'var(--accent-green-dim)' : 'transparent',
                  color: activeStep === 4 ? 'var(--accent-green)' : 'var(--text-dim)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.9rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Zap size={18} />
                  <span>04. Mint Tokens</span>
                </div>
                {activeStep === 4 && <ArrowRight size={16} />}
              </button>

              {/* Step 5 */}
              <button 
                onClick={() => updateActiveStep(5)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem',
                  borderRadius: '0.5rem',
                  border: activeStep === 5 ? '1px solid var(--accent-green-border)' : '1px solid transparent',
                  backgroundColor: activeStep === 5 ? 'var(--accent-green-dim)' : 'transparent',
                  color: activeStep === 5 ? 'var(--accent-green)' : 'var(--text-dim)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.9rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Settings size={18} />
                  <span>05. Settings</span>
                </div>
                {activeStep === 5 && <ArrowRight size={16} />}
              </button>
            </div>
          </div>

          {/* Platform Stats Card */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div className="font-mono text-sm text-dim" style={{ marginBottom: '1.5rem' }}>
              // PLATFORM STATS
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                <span>Token Created</span>
                <span style={{ color: isTokenCreated ? 'var(--accent-green)' : 'white' }}>{isTokenCreated ? 'YES' : 'NO'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                <span>Treasury Init</span>
                <span style={{ color: isTreasuryInitialized ? 'var(--accent-green)' : 'white' }}>{isTreasuryInitialized ? 'YES' : 'NO'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                <span>Metadata Set</span>
                <span style={{ color: isMetadataStored ? 'var(--accent-green)' : 'white' }}>{isMetadataStored ? 'YES' : 'NO'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                <span>Total Minted</span>
                <span style={{ color: totalMinted > 0 ? 'var(--accent-green)' : 'white' }}>{totalMinted.toLocaleString()} {tokenSymbol}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                <span>Vault Balance</span>
                <span style={{ color: 'white' }}>{vaultBalance.toFixed(3)} SOL</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                <span>Settings Set</span>
                <span style={{ color: isSettingsSet ? 'var(--accent-green)' : 'white' }}>{isSettingsSet ? 'LIVE' : 'PENDING'}</span>
              </div>
            </div>
          </div>
          
        </div>

        {/* RIGHT CONTENT AREA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {activeStep === 1 && (
            <>
              {/* Token Creation Process Card */}
              <div className="card animate-fade-in" style={{ padding: '2rem' }}>
                
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '2.5rem' }}>
                  <div style={{
                    backgroundColor: 'var(--accent-green-dim)',
                    border: '1px solid var(--accent-green-border)',
                    color: 'var(--accent-green)',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Coins size={20} />
                  </div>
                  <div>
                    <div className="font-mono text-dim text-xs tracking-wide" style={{ marginBottom: '0.25rem' }}>STEP 01</div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Create SPL Token</h2>
                  </div>
                </div>

                {/* Form Fields */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                  {/* Decimals Field */}
                  <div>
                    <label className="font-mono text-dim text-xs tracking-wide uppercase" style={{ display: 'block', marginBottom: '0.5rem' }}>
                      DECIMALS
                    </label>
                    <input 
                      type="number" 
                      value={decimals}
                      onChange={(e) => setDecimals(Number(e.target.value))}
                      disabled={isTokenCreated || isCreating}
                      style={{
                        width: '100%',
                        backgroundColor: '#0a0a0a',
                        border: '1px solid var(--card-border)',
                        borderRadius: '0.5rem',
                        padding: '1rem',
                        color: (isTokenCreated || isCreating) ? 'var(--text-dim)' : 'white',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '1rem',
                        outline: 'none',
                        transition: 'border-color 0.2s',
                        cursor: (isTokenCreated || isCreating) ? 'not-allowed' : 'text'
                      }}
                      onFocus={(e) => { if(!isTokenCreated) e.target.style.borderColor = 'var(--text-dim)' }}
                      onBlur={(e) => { if(!isTokenCreated) e.target.style.borderColor = 'var(--card-border)' }}
                    />
                  </div>

                  {/* Token Program Field */}
                  <div>
                    <label className="font-mono text-dim text-xs tracking-wide uppercase" style={{ display: 'block', marginBottom: '0.5rem' }}>
                      TOKEN PROGRAM
                    </label>
                    <input 
                      type="text" 
                      value="SPL Token (v2)"
                      disabled
                      style={{
                        width: '100%',
                        backgroundColor: '#0a0a0a',
                        border: '1px solid var(--card-border)',
                        borderRadius: '0.5rem',
                        padding: '1rem',
                        color: 'var(--text-dim)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '1rem',
                        outline: 'none',
                        cursor: 'not-allowed'
                      }}
                    />
                  </div>
                </div>

                {/* State based Action Area */}
                {isTokenCreated ? (
                  <div className="animate-fade-in">
                    <div style={{ 
                      border: '1px solid var(--accent-green-border)', 
                      backgroundColor: 'var(--accent-green-dim)', 
                      borderRadius: '0.5rem', 
                      padding: '1rem', 
                      marginBottom: '1.5rem' 
                    }}>
                        <div className="font-mono text-dim text-xs tracking-wide uppercase" style={{ marginBottom: '0.5rem' }}>MINT ADDRESS</div>
                        <div className="font-mono text-green">{mintAddress}</div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <CheckCircle size={18} /> Token Created
                        </div>
                        <button onClick={() => updateActiveStep(2)} style={{ background: 'none', border: 'none', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontFamily: 'var(--font-main)' }}>
                           Next Step <ArrowRight size={16} />
                        </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={handleCreateToken} disabled={isCreating} className="btn btn-primary" style={{ padding: '0.875rem 2rem', opacity: isCreating ? 0.7 : 1 }}>
                    <Zap size={18} /> {isCreating ? 'CREATING...' : 'CREATE TOKEN'}
                  </button>
                )}
              </div>

              {/* Transaction Logs Map */}
              <div className="card" style={{ padding: '1.25rem' }}>
                  <div className="font-mono text-sm text-dim" style={{ marginBottom: '1rem' }}>// TRANSACTION LOG</div>
                  {logs.length === 0 ? (
                      <div className="font-mono text-sm text-dim" style={{ opacity: 0.5 }}>No transactions yet... connect wallet and execute to see logs.</div>
                  ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                          {logs.map((log, index) => (
                              <div key={index} className="font-mono text-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: log.error ? '#ef4444' : 'var(--accent-green)' }}>
                                  <CheckCircle size={14} />
                                  <span style={{ color: 'var(--text-dim)' }}>[{log.time}]</span>
                                  <span>{log.message}</span>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
            </>
          )}

          {activeStep === 2 && (
            <>
              {/* Init Treasury Process Card */}
              <div className="card animate-fade-in" style={{ padding: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '2.5rem' }}>
                  <div style={{
                    backgroundColor: 'var(--accent-green-dim)',
                    border: '1px solid var(--accent-green-border)',
                    color: 'var(--accent-green)',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <BarChart3 size={20} />
                  </div>
                  <div>
                    <div className="font-mono text-dim text-xs tracking-wide" style={{ marginBottom: '0.25rem' }}>STEP 02</div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Initialize Treasury</h2>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '2rem', marginBottom: '2rem' }}>
                  {/* Token Vault Info */}
                  <div style={{ padding: '1.5rem', border: '1px solid var(--card-border)', borderRadius: '0.5rem', backgroundColor: '#0a0a0a' }}>
                    <div className="font-mono text-dim text-xs tracking-wide uppercase" style={{ marginBottom: '1rem' }}>TREASURY TOKEN ACCOUNT</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {totalMinted.toLocaleString()} <span style={{ color: 'var(--accent-green)', fontSize: '0.9rem' }}>{tokenSymbol}</span>
                    </div>
                    {isTreasuryInitialized ? (
                        <div className="font-mono text-green text-xs" style={{ marginTop: '0.5rem', wordBreak: 'break-all' }}>
                          {treasuryAta}
                        </div>
                    ) : (
                        <div className="text-dim text-sm" style={{ marginTop: '0.5rem' }}>Will hold POLL tokens</div>
                    )}
                  </div>

                  {/* SOL Vault Info */}
                  <div style={{ padding: '1.5rem', border: '1px solid var(--card-border)', borderRadius: '0.5rem', backgroundColor: '#0a0a0a' }}>
                    <div className="font-mono text-dim text-xs tracking-wide uppercase" style={{ marginBottom: '1rem' }}>SOL VAULT</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {vaultBalance.toFixed(2)} <span style={{ color: '#eab308', fontSize: '0.9rem' }}>SOL</span>
                    </div>
                    {isTreasuryInitialized ? (
                        <div className="font-mono text-green text-xs" style={{ marginTop: '0.5rem', wordBreak: 'break-all' }}>
                          {solVault}
                        </div>
                    ) : (
                        <div className="text-dim text-sm" style={{ marginTop: '0.5rem' }}>Holds buy/redeem SOL</div>
                    )}
                  </div>
                </div>

                {/* State based Action Area */}
                {isTreasuryInitialized ? (
                  <div className="animate-fade-in">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <CheckCircle size={18} /> Treasury Initialized
                        </div>
                        <button onClick={() => updateActiveStep(3)} style={{ background: 'none', border: 'none', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontFamily: 'var(--font-main)' }}>
                           Next Step <ArrowRight size={16} />
                        </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={handleInitTreasury} disabled={!isTokenCreated || isInitializing} className="btn btn-primary" style={{ padding: '0.875rem 2rem', opacity: (!isTokenCreated || isInitializing) ? 0.6 : 1, cursor: (!isTokenCreated || isInitializing) ? 'not-allowed' : 'pointer' }}>
                    <BarChart3 size={18} /> {isInitializing ? 'INITIALIZING...' : 'INITIALIZE TREASURY'}
                  </button>
                )}
              </div>

               {/* Transaction Logs Map */}
              <div className="card" style={{ padding: '1.25rem' }}>
                  <div className="font-mono text-sm text-dim" style={{ marginBottom: '1rem' }}>// TRANSACTION LOG</div>
                  {logs.length === 0 ? (
                      <div className="font-mono text-sm text-dim" style={{ opacity: 0.5 }}>No transactions yet... connect wallet and execute to see logs.</div>
                  ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                          {logs.map((log, index) => (
                              <div key={index} className="font-mono text-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: log.error ? '#ef4444' : 'var(--accent-green)' }}>
                                  <CheckCircle size={14} />
                                  <span style={{ color: 'var(--text-dim)' }}>[{log.time}]</span>
                                  <span>{log.message}</span>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
            </>
          )}
          {activeStep === 3 && (
            <>
              {/* Token Metadata Process Card */}
              <div className="card animate-fade-in" style={{ padding: '2rem' }}>
                
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '2.5rem' }}>
                  <div style={{
                    backgroundColor: 'var(--accent-green-dim)',
                    border: '1px solid var(--accent-green-border)',
                    color: 'var(--accent-green)',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Fingerprint size={20} />
                  </div>
                  <div>
                    <div className="font-mono text-dim text-xs tracking-wide" style={{ marginBottom: '0.25rem' }}>STEP 03</div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Token Metadata</h2>
                  </div>
                </div>

                {/* Form Fields */}
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 0.75fr)', gap: '1.5rem', marginBottom: '1.5rem' }}>
                  {/* Name Field */}
                  <div>
                    <label className="font-mono text-dim text-xs tracking-wide uppercase" style={{ display: 'block', marginBottom: '0.5rem' }}>
                      TOKEN NAME
                    </label>
                    <input 
                      type="text" 
                      value={tokenName}
                      onChange={(e) => setTokenName(e.target.value)}
                      disabled={isMetadataStored || isStoringMetadata}
                      placeholder="e.g. My Awesome Token"
                      style={{
                        width: '100%',
                        backgroundColor: '#0a0a0a',
                        border: '1px solid var(--card-border)',
                        borderRadius: '0.5rem',
                        padding: '1rem',
                        color: (isMetadataStored || isStoringMetadata) ? 'var(--text-dim)' : 'white',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '1rem',
                        outline: 'none',
                        transition: 'border-color 0.2s',
                      }}
                    />
                  </div>

                  {/* Symbol Field */}
                  <div>
                    <label className="font-mono text-dim text-xs tracking-wide uppercase" style={{ display: 'block', marginBottom: '0.5rem' }}>
                      SYMBOL
                    </label>
                    <input 
                      type="text" 
                      value={tokenSymbol}
                      onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                      disabled={isMetadataStored || isStoringMetadata}
                      placeholder="e.g. TKN"
                      style={{
                        width: '100%',
                        backgroundColor: '#0a0a0a',
                        border: '1px solid var(--card-border)',
                        borderRadius: '0.5rem',
                        padding: '1rem',
                        color: (isMetadataStored || isStoringMetadata) ? 'var(--text-dim)' : 'white',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '1rem',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                {/* Metadata Action Area */}

                {/* Action Area */}
                {isMetadataStored ? (
                  <div className="animate-fade-in">
                    {/* Preview Card */}
                    <div style={{ 
                      backgroundColor: 'rgba(34, 197, 94, 0.05)', 
                      border: '1px solid rgba(34, 197, 94, 0.1)', 
                      borderRadius: '0.75rem', 
                      padding: '1.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1.25rem',
                      marginBottom: '1.5rem'
                    }}>
                        <div style={{
                             width: '50px',
                             height: '50px',
                             backgroundColor: '#1a1a1a',
                             borderRadius: '50%',
                             display: 'flex',
                             alignItems: 'center',
                             justifyContent: 'center',
                             color: 'var(--accent-green)',
                             fontSize: '1.25rem',
                             fontWeight: 900,
                             border: '1px solid var(--card-border)'
                        }}>
                             {tokenSymbol?.charAt(0) || '?'}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.2rem' }}>{tokenName}</div>
                            <div className="font-mono text-dim text-sm">{tokenSymbol}</div>
                        </div>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-green)' }}></div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <div style={{ color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                            <CheckCircle size={18} /> Metadata Stored
                        </div>
                        <button onClick={() => updateActiveStep(4)} style={{ background: 'none', border: 'none', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 500 }}>
                           Next Step <ArrowRight size={16} />
                        </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={handleSetMetadata} disabled={isStoringMetadata} className="btn btn-primary" style={{ padding: '0.875rem 2.5rem', opacity: isStoringMetadata ? 0.7 : 1 }}>
                    <Fingerprint size={18} /> {isStoringMetadata ? 'STORING...' : 'STORE METADATA'}
                  </button>
                )}
              </div>

              {/* Transaction Logs Map */}
              <div className="card" style={{ padding: '1.25rem' }}>
                  <div className="font-mono text-sm text-dim" style={{ marginBottom: '1rem' }}>// TRANSACTION LOG</div>
                  {logs.length === 0 ? (
                      <div className="font-mono text-sm text-dim" style={{ opacity: 0.5 }}>No transactions yet... connect wallet and execute to see logs.</div>
                  ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '150px', overflowY: 'auto' }}>
                          {logs.map((log, index) => (
                              <div key={index} className="font-mono text-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: log.error ? '#ef4444' : 'var(--accent-green)' }}>
                                  <CheckCircle size={14} />
                                  <span style={{ color: 'var(--text-dim)' }}>[{log.time}]</span>
                                  <span>{log.message}</span>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
            </>
          )}
          {activeStep === 4 && (
            <>
              {/* Mint Tokens Process Card */}
              <div className="card animate-fade-in" style={{ padding: '2rem' }}>
                
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '2.5rem' }}>
                  <div style={{
                    backgroundColor: 'var(--accent-green-dim)',
                    border: '1px solid var(--accent-green-border)',
                    color: 'var(--accent-green)',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Zap size={20} />
                  </div>
                  <div>
                    <div className="font-mono text-dim text-xs tracking-wide" style={{ marginBottom: '0.25rem' }}>STEP 04</div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Mint Tokens</h2>
                  </div>
                </div>

                <div style={{ marginBottom: '2rem' }}>
                  <label className="font-mono text-dim text-xs tracking-wide uppercase" style={{ display: 'block', marginBottom: '0.5rem' }}>
                    AMOUNT TO MINT
                  </label>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <input 
                      type="number" 
                      value={mintAmount}
                      onChange={(e) => setMintAmount(Number(e.target.value))}
                      disabled={isMinting}
                      style={{
                        flex: 1,
                        backgroundColor: '#0a0a0a',
                        border: '1px solid var(--card-border)',
                        borderRadius: '0.5rem',
                        padding: '1rem',
                        color: 'white',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '1.5rem',
                        fontWeight: 700,
                        outline: 'none',
                      }}
                    />
                    <div style={{ 
                      backgroundColor: '#1a1a1a', 
                      border: '1px solid var(--card-border)', 
                      borderRadius: '0.5rem', 
                      padding: '0 1.5rem', 
                      display: 'flex', 
                      alignItems: 'center', 
                      color: 'var(--accent-green)',
                      fontWeight: 800,
                      fontSize: '1.2rem'
                    }}>
                        {tokenSymbol}
                    </div>
                  </div>
                </div>

                <div style={{ 
                    backgroundColor: '#0a0a0a', 
                    border: '1px solid var(--card-border)', 
                    borderRadius: '0.5rem', 
                    padding: '1.25rem',
                    marginBottom: '2rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                        <span className="text-dim">Current Supply:</span>
                        <span style={{ color: 'white', fontWeight: 600 }}>{totalMinted.toLocaleString()} {tokenSymbol}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                        <span className="text-dim">Destination:</span>
                        <span style={{ color: 'var(--accent-green)', fontWeight: 600, fontSize: '0.8rem' }}>{formatAddress(treasuryAta)} (Treasury)</span>
                    </div>
                </div>

                <button onClick={handleMintTokens} disabled={isMinting || !isTreasuryInitialized} className="btn btn-primary" style={{ padding: '0.875rem 2.5rem', opacity: (isMinting || !isTreasuryInitialized) ? 0.7 : 1 }}>
                  <Zap size={18} /> {isMinting ? 'MINTING...' : `MINT ${tokenSymbol} TOKENS`}
                </button>
              </div>

               {/* Transaction Logs Map */}
               <div className="card" style={{ padding: '1.25rem' }}>
                  <div className="font-mono text-sm text-dim" style={{ marginBottom: '1rem' }}>// TRANSACTION LOG</div>
                  {logs.length === 0 ? (
                      <div className="font-mono text-sm text-dim" style={{ opacity: 0.5 }}>No transactions yet... connect wallet and execute to see logs.</div>
                  ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '150px', overflowY: 'auto' }}>
                          {logs.map((log, index) => (
                              <div key={index} className="font-mono text-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: log.error ? '#ef4444' : 'var(--accent-green)' }}>
                                  <CheckCircle size={14} />
                                  <span style={{ color: 'var(--text-dim)' }}>[{log.time}]</span>
                                  <span>{log.message}</span>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
            </>
          )}
          {activeStep === 5 && (
            <>
              {/* Platform Settings Process Card */}
              <div className="card animate-fade-in" style={{ padding: '2rem' }}>
                
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '2.5rem' }}>
                  <div style={{
                    backgroundColor: 'var(--accent-green-dim)',
                    border: '1px solid var(--accent-green-border)',
                    color: 'var(--accent-green)',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Settings size={20} />
                  </div>
                  <div>
                    <div className="font-mono text-dim text-xs tracking-wide" style={{ marginBottom: '0.25rem' }}>STEP 05</div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Platform Settings</h2>
                  </div>
                </div>

                {/* Grid Inputs */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                    {/* Token Price */}
                    <div>
                        <label className="font-mono text-dim text-xs tracking-wide uppercase" style={{ display: 'block', marginBottom: '0.5rem' }}>
                            TOKEN PRICE (SOL)
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input 
                                type="number" 
                                value={tokenPrice}
                                onChange={(e) => setTokenPrice(Number(e.target.value))}
                                style={{ width: '100%', backgroundColor: '#0a0a0a', border: '1px solid var(--card-border)', borderRadius: '0.5rem', padding: '1rem', color: 'white', fontFamily: 'var(--font-mono)', outline: 'none' }}
                            />
                            <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', fontSize: '0.8rem' }}>SOL</span>
                        </div>
                        <p className="text-dim" style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>Cost per {tokenSymbol} token</p>
                    </div>

                    {/* Proposal Cost */}
                    <div>
                        <label className="font-mono text-dim text-xs tracking-wide uppercase" style={{ display: 'block', marginBottom: '0.5rem' }}>
                            PROPOSAL COST ({tokenSymbol})
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input 
                                type="number" 
                                value={proposalCost}
                                onChange={(e) => setProposalCost(Number(e.target.value))}
                                style={{ width: '100%', backgroundColor: '#0a0a0a', border: '1px solid var(--card-border)', borderRadius: '0.5rem', padding: '1rem', color: 'white', fontFamily: 'var(--font-mono)', outline: 'none' }}
                            />
                            <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', fontSize: '0.8rem' }}>{tokenSymbol}</span>
                        </div>
                        <p className="text-dim" style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>Tokens to create proposal</p>
                    </div>

                    {/* Vote Cost */}
                    <div>
                        <label className="font-mono text-dim text-xs tracking-wide uppercase" style={{ display: 'block', marginBottom: '0.5rem' }}>
                            VOTE COST ({tokenSymbol})
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input 
                                type="number" 
                                value={voteCost}
                                onChange={(e) => setVoteCost(Number(e.target.value))}
                                style={{ width: '100%', backgroundColor: '#0a0a0a', border: '1px solid var(--card-border)', borderRadius: '0.5rem', padding: '1rem', color: 'white', fontFamily: 'var(--font-mono)', outline: 'none' }}
                            />
                            <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', fontSize: '0.8rem' }}>{tokenSymbol}</span>
                        </div>
                        <p className="text-dim" style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>Tokens to cast a vote</p>
                    </div>

                    {/* Fee Basis Points */}
                    <div>
                        <label className="font-mono text-dim text-xs tracking-wide uppercase" style={{ display: 'block', marginBottom: '0.5rem' }}>
                            PLATFORM FEE (%)
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input 
                                type="number" 
                                value={feePercentage}
                                onChange={(e) => setFeePercentage(Number(e.target.value))}
                                style={{ width: '100%', backgroundColor: '#0a0a0a', border: '1px solid var(--card-border)', borderRadius: '0.5rem', padding: '1rem', color: 'white', fontFamily: 'var(--font-mono)', outline: 'none' }}
                            />
                            <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', fontSize: '0.8rem' }}>%</span>
                        </div>
                        <p className="text-dim" style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>Fee on all transactions</p>
                    </div>
                </div>

                {/* Preview Box */}
                <div style={{ 
                    backgroundColor: '#0a0a0a', 
                    border: '1px solid var(--card-border)', 
                    borderRadius: '0.5rem', 
                    padding: '1.25rem',
                    marginBottom: '2rem'
                }}>
                    <div className="font-mono text-xs text-dim uppercase" style={{ marginBottom: '1rem' }}>Pricing Preview</div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-dim)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div>Buy 10 tokens: <span style={{ color: 'white' }}>{(10 * tokenPrice).toFixed(1)} SOL</span> + <span style={{ color: 'var(--accent-green)' }}>{(10 * tokenPrice * (feePercentage/100)).toFixed(3)} SOL fee</span> = <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>{(10 * tokenPrice * (1 + feePercentage/100)).toFixed(3)} SOL total</span></div>
                        <div>Redeem 10 tokens: <span style={{ color: 'white' }}>{(10 * tokenPrice * (1 - feePercentage/100)).toFixed(3)} SOL</span> (after {feePercentage}% fee)</div>
                    </div>
                </div>

                {/* State based Action Area */}
                {isSettingsSet ? (
                   <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                       <div style={{ color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                           <CheckCircle size={18} /> Platform is LIVE – All steps complete!
                       </div>
                       {/* <button onClick={handleSaveSettings} disabled={isSavingSettings} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                          [ Update Settings ]
                       </button> */}
                   </div>
                ) : (
                  <button onClick={handleSaveSettings} disabled={isSavingSettings || !isTreasuryInitialized} className="btn btn-primary" style={{ padding: '0.875rem 2.5rem', opacity: (isSavingSettings || !isTreasuryInitialized) ? 0.7 : 1 }}>
                    <Zap size={18} /> {isSavingSettings ? 'SAVING...' : 'SAVE SETTINGS'}
                  </button>
                )}
              </div>

              {/* Vault Management Card */}
              <div className="card animate-fade-in" style={{ padding: '2rem', border: '1px solid var(--accent-green-border)', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(0,0,0,0) 100%)', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                         <div style={{ color: 'var(--accent-green)' }}><Zap size={24} /></div>
                         <div>
                            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Vault Management</h3>
                            <p className="text-dim" style={{ fontSize: '0.8rem', margin: 0 }}>Accumulated platform fees in SOL vault</p>
                         </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                         <div className="font-mono" style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-green)' }}>{vaultBalance.toFixed(4)} SOL</div>
                         <div className="font-mono text-dim" style={{ fontSize: '0.7rem' }}>CURRENT BALANCE</div>
                      </div>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem' }}>
                      <div style={{ flex: 1, position: 'relative' }}>
                          <input 
                              type="number" 
                              placeholder="Amount to withdraw"
                              value={withdrawAmount || ''}
                              onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                              style={{ width: '100%', backgroundColor: '#0a0a0a', border: '1px solid var(--card-border)', borderRadius: '0.5rem', padding: '0.875rem', color: 'white', fontFamily: 'var(--font-mono)', outline: 'none' }}
                          />
                          <button 
                            onClick={() => setWithdrawAmount(vaultBalance)}
                            style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'var(--card-border)', border: 'none', color: 'white', borderRadius: '4px', padding: '0.2rem 0.5rem', fontSize: '0.7rem', cursor: 'pointer' }}
                          >
                            MAX
                          </button>
                      </div>
                      <button 
                         onClick={handleWithdrawFees}
                         disabled={isWithdrawing || withdrawAmount <= 0 || withdrawAmount > vaultBalance}
                         className="btn btn-primary" 
                         style={{ padding: '0 2rem', opacity: (isWithdrawing || withdrawAmount <= 0) ? 0.6 : 1 }}
                      >
                         {isWithdrawing ? 'WITHDRAWING...' : 'WITHDRAW SOL'}
                      </button>
                  </div>
               </div>

               {/* Transaction Logs Map */}
               <div className="card" style={{ padding: '1.25rem' }}>
                  <div className="font-mono text-sm text-dim" style={{ marginBottom: '1rem' }}>// TRANSACTION LOG</div>
                  {logs.length === 0 ? (
                      <div className="font-mono text-sm text-dim" style={{ opacity: 0.5 }}>No transactions yet... connect wallet and execute to see logs.</div>
                  ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '150px', overflowY: 'auto' }}>
                          {logs.map((log, index) => (
                              <div key={index} className="font-mono text-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: log.error ? '#ef4444' : 'var(--accent-green)' }}>
                                  <CheckCircle size={14} />
                                  <span style={{ color: 'var(--text-dim)' }}>[{log.time}]</span>
                                  <span>{log.message}</span>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
