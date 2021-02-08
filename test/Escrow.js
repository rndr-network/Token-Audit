const { BN, fromWei, toWei } = web3.utils;
const { abi } = web3.eth;
const Escrow = artifacts.require('Escrow');
const RenderToken = artifacts.require('RenderToken');
const { deployProxy } = require('@openzeppelin/truffle-upgrades');

require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bn')(BN))
    .should();

const name = "RenderToken";
const symbol = "RNDR";

contract('Escrow', (accounts) => {
  const owner = accounts[0];
  const childChainManagerProxy = accounts[1];

  let sampleJob1 = {
    id: 'SampleJob1',
    cost: new BN(toWei("10"))
  };
  let sampleJob2 = {
    id: 'SampleJob2',
    cost: new BN(toWei("20"))
  };

  beforeEach(async () => {
    const renderTokenContractOwner = accounts[0];
    const escrowContractOwner = accounts[0];

    // Create and initialize Render Token contract
    renderToken = await deployProxy(RenderToken, [owner, childChainManagerProxy, name, symbol]);
    renderTokenAddress = await renderToken.address;

    // Create and initialize Escrow contract
    escrow = await deployProxy(Escrow, [owner, renderToken.address]);
    escrowAddress = await escrow.address;

    // Add funds to accounts
    let amount = toWei("100");
    for (let account of accounts) {
      await renderToken.deposit(account, abi.encodeParameter('uint256', amount.toString()), {from: childChainManagerProxy})
    }

    // Set escrow contract address
    await renderToken.setEscrowContractAddress(escrowAddress);
  });

  describe('Should allow stored addresses to be changed', () => {

    it('should prevent non-owners from updating the disbursal address', async () => {
      let oldDisbursal = await escrow.disbursalAddress();

      await escrow.changeDisbursalAddress(accounts[1], {from: accounts[3]})
        .should.be.rejectedWith('revert');
    });

    it('should allow owner to update the disbursal address', async () => {
      let oldDisbursal = await escrow.disbursalAddress();

      await escrow.changeDisbursalAddress(accounts[1]);
      let newDisbursal = escrow.disbursalAddress();

      assert.notEqual(oldDisbursal, newDisbursal);
    });

    it('should prevent non-owners from updating the Render Token address', async () => {
      let oldDisbursal = await escrow.renderTokenAddress();

      await escrow.changeRenderTokenAddress(accounts[1], {from: accounts[3]})
        .should.be.rejectedWith('revert');
    });

    it('should allow owner to update the Render Token address', async () => {
      let oldToken = await escrow.renderTokenAddress();

      await escrow.changeRenderTokenAddress(accounts[1]);
      let newToken = escrow.renderTokenAddress();

      assert.notEqual(oldToken, newToken);
    });
  });

  describe('Should receive RNDR tokens', () => {

    it('should assign tokens transferred to a job ID', async () => {
      await renderToken.holdInEscrow(sampleJob1.id, sampleJob1.cost, {from: accounts[0]});
      assert.equal(sampleJob1.cost, Number(await escrow.userBalance(sampleJob1.id)), 'Job balance was not updated');
    });

    it('should allow job funds to be increased', async () => {
      await renderToken.holdInEscrow(sampleJob1.id, sampleJob1.cost, {from: accounts[0]});
      // Sending job data a second time to increase the job's funds
      await renderToken.holdInEscrow(sampleJob1.id, sampleJob1.cost, {from: accounts[0]});
      assert.equal(sampleJob1.cost * 2, Number(await escrow.userBalance(sampleJob1.id)), 'Job balance was not increased');
    });
  });

  describe('Should disburse RNDR tokens', () => {

    it('should disburse tokens to a single', async () => {
      let disbursalAddress = await escrow.disbursalAddress();
      let originalMinerBalance = await renderToken.balanceOf(accounts[1]);

      await renderToken.holdInEscrow(sampleJob1.id, sampleJob1.cost, {from: accounts[0]});
      let originalUserBalance = await escrow.userBalance(sampleJob1.id);
      assert.equal(sampleJob1.cost.toString(), originalUserBalance.toString(), 'Job balance was not updated');

      await escrow.disburseFunds(sampleJob1.id, [accounts[1]], [sampleJob1.cost], {from: disbursalAddress});
      let newMinerBalance = await renderToken.balanceOf(accounts[1]);
      let newUserBalance = await escrow.userBalance(sampleJob1.id);

      assert.equal(newUserBalance.toString(), "0");
      assert.equal(originalMinerBalance.add(originalUserBalance).toString(), newMinerBalance.toString());
    });

    it('should disburse tokens to multiple miners', async () => {
      let disbursalAddress = await escrow.disbursalAddress();
      let originalMinerBalance1 = await renderToken.balanceOf(accounts[1]);
      let originalMinerBalance2 = await renderToken.balanceOf(accounts[2]);
      let originalMinerBalance3 = await renderToken.balanceOf(accounts[3]);
      let originalMinerBalance4 = await renderToken.balanceOf(accounts[4]);

      await renderToken.holdInEscrow(sampleJob1.id, sampleJob1.cost, {from: accounts[0]});
      let originalUserBalance = await escrow.userBalance(sampleJob1.id);
      assert.equal(sampleJob1.cost.toString(), originalUserBalance.toString(), 'Job balance was not updated');

      let minerArray = [accounts[1], accounts[2], accounts[3], accounts[4]];
      let paymentArray = [sampleJob1.cost.div(new BN(4)),
                          sampleJob1.cost.div(new BN(4)),
                          sampleJob1.cost.div(new BN(4)),
                          sampleJob1.cost.div(new BN(4))]

      await escrow.disburseFunds(sampleJob1.id, minerArray, paymentArray, {from: disbursalAddress});
      let newMinerBalance1 = await renderToken.balanceOf(accounts[1]);
      let newMinerBalance2 = await renderToken.balanceOf(accounts[2]);
      let newMinerBalance3 = await renderToken.balanceOf(accounts[3]);
      let newMinerBalance4 = await renderToken.balanceOf(accounts[4]);
      let newUserBalance = await escrow.userBalance(sampleJob1.id);

      assert.equal(newUserBalance.toString(), "0");
      assert.equal(originalMinerBalance1.add(originalUserBalance.div(new BN(4))).toString(), newMinerBalance1.toString());
      assert.equal(originalMinerBalance2.add(originalUserBalance.div(new BN(4))).toString(), newMinerBalance2.toString());
      assert.equal(originalMinerBalance3.add(originalUserBalance.div(new BN(4))).toString(), newMinerBalance3.toString());
      assert.equal(originalMinerBalance4.add(originalUserBalance.div(new BN(4))).toString(), newMinerBalance4.toString());
    });
  });
});
