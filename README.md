# POLL.SOL - Tokenized Voting Platform on Solana 🗳️💎

POLL.SOL is a decentralized, tokenized polling application built on the Solana blockchain. It allows administrators to create a native SPL token, initialize a platform treasury, and enables users to buy tokens, stake them to create proposals, and vote on polls. Users can also withdraw their earnings back to SOL.

This project consists of two main parts:

1. **Solana Smart Contract** (written in Rust using the Anchor framework)
2. **React Frontend** (built with Vite, Tailwind-like styling, and `@solana/wallet-adapter`)

---

## 🛠️ Prerequisites

Before you begin, ensure you have the following installed on your system (preferably using WSL if on Windows):

1. **Node.js & npm/yarn** (v18+ recommended)
2. **Rust & Cargo** (latest stable version)
3. **Solana CLI** (`solana --version`)
4. **Anchor Framework** (`anchor --version`)
5. Phanton Wallet extension installed in your browser.

---

## ⚙️ Backend Setup (Smart Contract)

Follow these steps to build and deploy your own instance of the smart contract to the Solana Devnet.

### 1. Configure Solana for Devnet

Open your terminal and make sure you are targeting the Devnet:

```bash
solana config set --url devnet
```

### 2. Generate an Admin Keypair (If you don't have one)

You will need a Solana wallet to act as the "Admin" (the one paying for deployment and owning the treasury).

```bash
solana-keygen new -o ~/.config/solana/id.json
```

_Note down your Public Key, you will need it for the frontend._

### 3. Airdrop Devnet SOL

You need Devnet SOL to pay for deployment fees.

```bash
solana airdrop 5
```

_(If the airdrop fails due to rate limits, try getting SOL from a web faucet like faucet.solana.com)_

### 4. Build the Anchor Program

In the root directory of the project, run:

```bash
anchor build
```

### 5. Update Program ID

After the first build, a new keypair is generated for your program. Find its address:

```bash
anchor keys list
```

Copy the new Program ID, and update it in two places:

1. **`programs/polldotsol/src/lib.rs`**
   Replace the address inside `declare_id!("...")`
2. **`Anchor.toml`**
   Replace the address under `[programs.localnet]` and `[programs.devnet] polldotsol = "..."`

**Rebuild the program** after changing the Program ID:

```bash
anchor build
```

### 6. Copy the Generated IDL to the Frontend

The IDL (Interface Description Language) is how the frontend talks to the contract. Run this command in the root folder to copy it:

```bash
cp target/idl/polldotsol.json app/src/idl/polldotsol.json
```

_(Windows users: use `copy target\idl\polldotsol.json app\src\idl\polldotsol.json`)_

### 7. Deploy to Devnet

```bash
anchor deploy --provider.cluster devnet
```

---

## 💻 Frontend Setup (React Application)

Once the contract is live, you need to configure the frontend to talk to it.

### 1. Set the Admin Wallet Address

Open `app/src/pages/UserApp.jsx` and look for the `ADMIN_PUBKEY` constant. Update it to match the Wallet Address you used to deploy the contract.
_(You can find your address by running `solana address` in your terminal)._

```javascript
// Change this to your actual Public Key!
const ADMIN_PUBKEY = new PublicKey("YOUR_ADMIN_WALLET_ADDRESS_HERE");
```

### 2. Configure Admin Dashboard Credentials

Create a `.env` file inside the `app` folder (e.g., `app/.env`) containing your custom access credentials for the Admin panel:

```env
VITE_ADMIN_USERNAME=admin
VITE_ADMIN_EMAIL=admin@mail.com
VITE_ADMIN_PASSWORD=secretpassword
```

### 3. Install Dependencies

Navigate into the frontend folder:

```bash
cd app
npm install
```

### 4. Start the Application

```bash
npm run dev
```

The app will open typically at `http://localhost:5173`.

---

## 🚀 How to Initialize the Application

Because you deployed a fresh contract, the on-chain variables are empty.

1. **Open the Admin App**: Navigate to `http://localhost:5173/admin` in your browser.
2. **Login**: Use the credentials from your `.env` file.
3. **Connect Wallet**: Connect the Phantom Wallet that matches the `ADMIN_PUBKEY`.
4. **Create Token**: In Step 1, set up your token details (decimals, platform fee, prices) and click "Create SPL Token". Approve the transaction.
5. **Initialize Treasury**: In Step 2, click "Initialize Treasury" to set up the on-chain vault and platform accounts.
6. **Set Metadata**: In Step 3, define the Token Name and Symbol.
7. **Done!** The app is now fully functional! Users can navigate to the main landing page or `/app` to buy tokens, create proposals, and vote.

---

## 📋 Technology Stack

- **Smart Contract:** Rust, Anchor Framework 0.30.1, Solana Program Library (SPL)
- **Web Frontend:** React (Vite), JavaScript, Tailwind CSS (Vanilla implementation), Lucide React Icons
- **State Management:** Redux Toolkit
- **Wallet Connection:** @solana/wallet-adapter-react
