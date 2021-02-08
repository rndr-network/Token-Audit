
const HDWalletProvider = require("truffle-hdwallet-provider");
const infuraApiKey = require('./config').infuraApiKey;
const mnemonic = require('./config').mnemonic;

module.exports = {
  networks: {
    development: {
      host: 'localhost',
      port: 7545,
      network_id: '*'
    },
    local: {
      host: 'localhost',
      port: 9545,
      network_id: '*'
    },
    ropsten:  {
      provider: () => new HDWalletProvider(mnemonic, `https://ropsten.infura.io/${infuraApiKey}`),
      network_id: 3
    }
  },
  compilers: {
    solc: {
      version: "0.7.6",    // Fetch exact version from solc-bin (default: truffle's version)
      settings: {
        optimizer: {
          enabled: true,
          runs: 9999,   // Optimize for how many times you intend to run the code
          }
      }
    }
  }

};
