import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  isMenuOpen: false,
  totalPolls: 1284,
  pollTokensInEscrow: 48920,
  solCollected: 892.4,
  proposalsFinalized: 976,
  isAdminAuthenticated: localStorage.getItem('isAdminAuthenticated') === 'true',
};

export const appSlice = createSlice({
  name: "app",
  initialState,
  reducers: {
    toggleMenu: (state) => {
      state.isMenuOpen = !state.isMenuOpen;
    },
    setAdminAuthenticated: (state, action) => {
      state.isAdminAuthenticated = action.payload;
      if (action.payload) {
        localStorage.setItem('isAdminAuthenticated', 'true');
      } else {
        localStorage.removeItem('isAdminAuthenticated');
      }
    },
    logoutAdmin: (state) => {
      state.isAdminAuthenticated = false;
      localStorage.removeItem('isAdminAuthenticated');
    },
    // We will dispatch these from the blockchain data later
    setStats: (state, action) => {
      state.totalPolls = action.payload.totalPolls;
      state.pollTokensInEscrow = action.payload.pollTokensInEscrow;
      state.solCollected = action.payload.solCollected;
      state.proposalsFinalized = action.payload.proposalsFinalized;
    },
  },
});

export const { toggleMenu, setAdminAuthenticated, logoutAdmin, setStats } = appSlice.actions;

export default appSlice.reducer;
