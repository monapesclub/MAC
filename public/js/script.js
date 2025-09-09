class Header {
  constructor() {
    this.isLoggedIn = false;
    this.userData = null;
    this.walletData = null;
    this.sessionId = this.getCookie('sessionId');
  }

  async init() {
    await this.checkAuthStatus();
    if (this.isLoggedIn) {
      await this.checkWalletStatus();
    }
    this.updateUI(); // HTML ကို တိုက်ရိုက် update လုပ်ပါ
    this.bindEvents();
  }

  getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  async checkAuthStatus() {
    try {
      if (!this.sessionId) return;
      const response = await fetch('/api/auth/user');
      if (response.ok) {
        this.userData = await response.json();
        this.isLoggedIn = true;
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    }
  }

  async checkWalletStatus() {
    try {
      if (!this.sessionId) return;
      const response = await fetch('/api/wallet/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: this.sessionId })
      });
      if (response.ok) {
        this.walletData = await response.json();
      }
    } catch (error) {
      console.error('Wallet status check failed:', error);
    }
  }

  updateUI() {
    const userInfoSection = document.getElementById('userInfoSection');
    const loginSection = document.getElementById('loginSection');
    const dashboardLink = document.getElementById('dashboardLink');
    const headerUserAvatar = document.getElementById('headerUserAvatar');
    const headerUserName = document.getElementById('headerUserName');
    const headerAdminBadge = document.getElementById('headerAdminBadge');

    if (this.isLoggedIn) {
        userInfoSection.style.display = 'block';
        loginSection.style.display = 'none';
        dashboardLink.style.display = 'block';
        
        if (headerUserAvatar) {
            headerUserAvatar.src = this.userData.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png';
        }
        if (headerUserName) {
            headerUserName.textContent = `${this.userData.username}${this.userData.discriminator !== '0' ? `#${this.userData.discriminator}` : ''}`;
        }
        if (headerAdminBadge) {
            headerAdminBadge.style.display = this.userData.isAdmin ? 'inline-block' : 'none';
        }
    } else {
        userInfoSection.style.display = 'none';
        loginSection.style.display = 'block';
        dashboardLink.style.display = 'none';
    }

    const walletSection = document.getElementById('walletSection');
    walletSection.innerHTML = this.walletData && this.walletData.address ? 
        `<div class="wallet-info">
            <button class="btn btn-primary">
                <i class="fas fa-wallet"></i> ${this.walletData.shortenedAddress}
            </button>
            <button id="disconnectWalletBtn" class="btn btn-outline" style="margin-left: 10px;">
                <i class="fas fa-unlink"></i> Disconnect
            </button>
        </div>` : 
        `<button id="connectWalletBtn" class="btn btn-primary">
            <i class="fas fa-wallet"></i> Connect Wallet
        </button>`;
    
    this.bindEvents(); // DOM ပြီးသွားမှ Event listeners တွေကို ပြန်ချိတ်ပေးပါ
  }

  bindEvents() {
    document.getElementById('discordLoginBtn')?.addEventListener('click', () => { window.location.href = '/api/auth/discord'; });
    document.getElementById('logoutBtn')?.addEventListener('click', () => { this.logout(); });
    document.getElementById('connectWalletBtn')?.addEventListener('click', () => { this.connectWallet(); });
    document.getElementById('disconnectWalletBtn')?.addEventListener('click', () => { this.disconnectWallet(); });
  }

  // ... (connectWallet, disconnectWallet, logout functions) ...
  async connectWallet() {
    try {
      if (typeof window.ethereum === 'undefined') {
        alert('Please install a Web3 wallet like MetaMask to proceed!');
        return;
      }
      if (!this.sessionId) {
        alert('Please login with Discord first to connect your wallet.');
        return;
      }
  
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const address = accounts[0];
      const message = `MonadVerify Wallet Connection: ${Date.now()}`;
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [message, address]
      });
  
      const response = await fetch('/api/wallet/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, signature, message, sessionId: this.sessionId })
      });
      
      if (response.ok) {
        this.walletData = await response.json();
        this.updateUI(); // render() အစား updateUI() ကို ပြန်ခေါ်
        alert('Wallet connected successfully! Your NFTs should now be visible on your dashboard.');
        if (window.checkWalletAndLoadNFTs) {
          window.checkWalletAndLoadNFTs();
        }
      } else {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to connect wallet');
      }
    } catch (error) {
      if (error.code === 4001) {
        alert('Wallet connection cancelled by user.');
      } else {
        alert('Wallet connection error: ' + error.message);
      }
      console.error('Wallet connection error:', error);
    }
  }

  async disconnectWallet() {
    try {
      const response = await fetch('/api/wallet/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: this.sessionId })
      });
      
      if (response.ok) {
        this.walletData = null;
        this.updateUI(); // render() အစား updateUI() ကို ပြန်ခေါ်
        alert('Wallet disconnected successfully!');
        if (window.checkWalletAndLoadNFTs) {
          window.checkWalletAndLoadNFTs();
        }
      } else {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to disconnect wallet');
      }
    } catch (error) {
      console.error('Wallet disconnection error:', error);
      alert('Wallet disconnection failed: ' + error.message);
    }
  }
   async logout() {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      
      if (response.ok) {
        this.isLoggedIn = false;
        this.userData = null;
        this.walletData = null;
        this.sessionId = null;
        this.updateUI();
        window.location.href = '/';
      } else {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to logout');
      }
    } catch (error) {
      console.error('Logout error:', error);
      alert('Logout failed: ' + error.message);
    }
  }
}
// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const header = new Header();
    await header.init();
    
    const getStartedBtn = document.querySelector('.hero .btn');
    if (getStartedBtn) {
      getStartedBtn.addEventListener('click', () => {
        fetch('/api/auth/user')
          .then(response => response.ok ? response.json() : Promise.reject())
          .then(() => {
            window.location.href = '/dashboard';
          })
          .catch(() => {
            window.location.href = '/api/auth/discord';
          });
      });
    }
  } catch (error) {
    console.error('Failed to initialize application:', error);
  }
});