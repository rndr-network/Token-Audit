const { deployProxy } = require('@openzeppelin/truffle-upgrades');

const RenderToken = artifacts.require("RenderToken");
const Escrow = artifacts.require("Escrow");

const name = "RenderToken";
const symbol = "RNDR";

const owner = "0x0000000000000000000000000000000000000001";
const childChainManagerProxy = "0x0000000000000000000000000000000000000002";

module.exports = async (deployer, network) => {
  console.log("Deploying RenderToken...");
  await deployProxy(RenderToken, [owner, childChainManagerProxy, name, symbol], { deployer, initializer: 'initialize' });
  
  const renderToken = await RenderToken.deployed();
  console.log("Deployed RenderToken at", renderToken.address);

  console.log("With the following parameters:");
  console.log("Owner:", await renderToken.owner())
  console.log("childChainManagerProxy:", await renderToken.childChainManagerProxy())
  console.log("Name:", await renderToken.name())
  console.log("Symbol:", await renderToken.symbol())

  console.log("Deploying Escrow...");
  await deployProxy(Escrow, [owner, renderToken.address], { deployer, initializer: 'initialize' });
  
  const escrow = await Escrow.deployed();
  console.log("Deployed Escrow at", escrow.address);

  console.log("With the following parameters:");
  console.log("Owner:", await escrow.owner())
  console.log("Disbursal address:", await escrow.disbursalAddress())
  console.log("RenderToken address:", await escrow.renderTokenAddress())
};