
const HDWalletProvider = require("truffle-hdwallet-provider");
const infuraApiKey = require('./config').infuraApiKey;
const mnemonic = require('./config').mnemonic;

module.exports = {
  networks: {
    development: {
      host: 'localhost',
      port: 8545,
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
  }
};
