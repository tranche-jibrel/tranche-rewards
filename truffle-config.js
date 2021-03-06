const HDWalletProvider = require('@truffle/hdwallet-provider');
require('dotenv').config();

module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",     // Localhost (default: none)
      port: 8545,            // Standard Ethereum port (default: none)
      network_id: "*",       // Any network (default: none)
    },
    kovan: {
      networkCheckTimeout: 1000000,
      provider: () =>
        new HDWalletProvider(
          process.env.mnemonic,
          `https://kovan.infura.io/v3/${process.env.INFURA_KEY}`
        ),
      network_id: 42,
      gas: 6721975,
      gasPrice: 161000000000,
      confirmations: 2,
      timeoutBlocks: 2000,
      skipDryRun: true
    },
    mainnet: {
      provider: () =>
        new HDWalletProvider(
          process.env.mnemonic,
          `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`
        ),
      network_id: 1,
      gas: 5500000,
      gasPrice: 60000000000,
      timeoutBlocks: 200,
      confirmations: 2,
      skipDryRun: true
    },
  },

  plugins: ['truffle-contract-size',
    'solidity-coverage',
    'truffle-plugin-verify',
  ],

  // Set default mocha options here, use special reporters etc.
  mocha: {
    reporter: 'eth-gas-reporter',
    timeout: 100000
  },

  // Configure your compilers
  compilers: {
    solc: {
      version: "0.8.7",    // Fetch exact version from solc-bin (default: truffle's version)
      settings: {          // See the solidity docs for advice about optimization and evmVersion
        optimizer: {
          enabled: true,
          runs: 200
        },
        //evmVersion: "byzantium"
      }
    }
  }
};
