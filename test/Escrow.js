
const BigNumber = web3.BigNumber;
const Escrow = artifacts.require('Escrow');
const LegacyToken = artifacts.require('LegacyToken');
const RenderToken = artifacts.require('RenderToken');

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();


contract('Escrow', (accounts) => {

  const owner = accounts[0];
  let renderTokenDecimalFactor = 1000000000000000000;
  let sampleJob1 = {
    id: 'SampleJob1',
    cost: 10 * renderTokenDecimalFactor
  };
  let sampleJob2 = {
    id: 'SampleJob2',
    cost: 20 * renderTokenDecimalFactor
  };

  beforeEach(async () => {
    const renderTokenContractOwner = accounts[0];
    const escrowContractOwner = accounts[0];

    // Create legacy token for migrations
    this.legacyToken = await LegacyToken.new('Legacy Token', 'LTX', 18, {from: owner});
    legacyTokenAddress = await this.legacyToken.address;

    // Create and initialize Render Token contract
    this.renderToken = await RenderToken.new();
    this.renderToken.initialize(renderTokenContractOwner, legacyTokenAddress);
    this.renderTokenAddress = await this.renderToken.address;

    // Create and initialize Escrow contract
    this.escrow = await Escrow.new();
    this.escrow.initialize(escrowContractOwner, this.renderTokenAddress);
    this.escrowAddress = await this.escrow.address;

    // Add funds to accounts
    let amount = 100 * renderTokenDecimalFactor;
    for (let account of accounts) {
      await this.legacyToken.mint(account, amount);
      let balance = await this.legacyToken.balanceOf(account);
      await this.legacyToken.approve(this.renderTokenAddress, balance, {from: account});
      await this.renderToken.migrate({from: account});
    }

    // Set escrow contract address
    await this.renderToken.setEscrowContractAddress(this.escrowAddress);
  });

  describe('Should allow stored addresses to be changed', () => {

    it('should prevent non-owners from updating the disbursal address', async () => {
      let oldDisbursal = await this.escrow.disbursalAddress();

      await this.escrow.changeDisbursalAddress(accounts[1], {from: accounts[3]})
        .should.be.rejectedWith('revert');
    });

    it('should allow owner to update the disbursal address', async () => {
      let oldDisbursal = await this.escrow.disbursalAddress();

      await this.escrow.changeDisbursalAddress(accounts[1]);
      let newDisbursal = this.escrow.disbursalAddress();

      assert.notEqual(oldDisbursal, newDisbursal);
    });

    it('should prevent non-owners from updating the Render Token address', async () => {
      let oldDisbursal = await this.escrow.renderTokenAddress();

      await this.escrow.changeRenderTokenAddress(accounts[1], {from: accounts[3]})
        .should.be.rejectedWith('revert');
    });

    it('should allow owner to update the Render Token address', async () => {
      let oldToken = await this.escrow.renderTokenAddress();

      await this.escrow.changeRenderTokenAddress(accounts[1]);
      let newToken = this.escrow.renderTokenAddress();

      assert.notEqual(oldToken, newToken);
    });
  });

  describe('Should receive RNDR tokens', () => {

    it('should assign tokens transferred to a job ID', async () => {
      await this.renderToken.holdInEscrow(sampleJob1.id, sampleJob1.cost, {from: accounts[0]});
      assert.equal(sampleJob1.cost, Number(await this.escrow.jobBalance(sampleJob1.id)), 'Job balance was not updated');
    });

    it('should allow job funds to be increased', async () => {
      await this.renderToken.holdInEscrow(sampleJob1.id, sampleJob1.cost, {from: accounts[0]});
      // Sending job data a second time to increase the job's funds
      await this.renderToken.holdInEscrow(sampleJob1.id, sampleJob1.cost, {from: accounts[0]});
      assert.equal(sampleJob1.cost * 2, Number(await this.escrow.jobBalance(sampleJob1.id)), 'Job balance was not increased');
    });
  });

  describe('Should disburse RNDR tokens', () => {

    it('should disburse tokens to a single', async () => {
      let disbursalAddress = await this.escrow.disbursalAddress();
      let originalMinerBalance = Number(await this.renderToken.balanceOf(accounts[1]));

      await this.renderToken.holdInEscrow(sampleJob1.id, sampleJob1.cost, {from: accounts[0]});
      let originalJobBalance = Number(await this.escrow.jobBalance(sampleJob1.id));
      assert.equal(sampleJob1.cost, originalJobBalance, 'Job balance was not updated');

      await this.escrow.disburseJob(sampleJob1.id, [accounts[1]], [sampleJob1.cost], {from: disbursalAddress});
      let newMinerBalance = Number(await this.renderToken.balanceOf(accounts[1]));
      let newJobBalance = Number(await this.escrow.jobBalance(sampleJob1.id));

      assert.equal(newJobBalance, 0);
      assert.equal(originalMinerBalance + originalJobBalance, newMinerBalance);
    });

    it('should disburse tokens to multiple miners', async () => {
      let disbursalAddress = await this.escrow.disbursalAddress();
      let originalMinerBalance1 = Number(await this.renderToken.balanceOf(accounts[1]));
      let originalMinerBalance2 = Number(await this.renderToken.balanceOf(accounts[2]));
      let originalMinerBalance3 = Number(await this.renderToken.balanceOf(accounts[3]));
      let originalMinerBalance4 = Number(await this.renderToken.balanceOf(accounts[4]));

      await this.renderToken.holdInEscrow(sampleJob1.id, sampleJob1.cost, {from: accounts[0]});
      let originalJobBalance = Number(await this.escrow.jobBalance(sampleJob1.id));
      assert.equal(sampleJob1.cost, originalJobBalance, 'Job balance was not updated');

      let minerArray = [accounts[1], accounts[2], accounts[3], accounts[4]];
      let paymentArray = [sampleJob1.cost / 4, sampleJob1.cost / 4, sampleJob1.cost / 4, sampleJob1.cost / 4]

      await this.escrow.disburseJob(sampleJob1.id, minerArray, paymentArray, {from: disbursalAddress});
      let newMinerBalance1 = Number(await this.renderToken.balanceOf(accounts[1]));
      let newMinerBalance2 = Number(await this.renderToken.balanceOf(accounts[2]));
      let newMinerBalance3 = Number(await this.renderToken.balanceOf(accounts[3]));
      let newMinerBalance4 = Number(await this.renderToken.balanceOf(accounts[4]));
      let newJobBalance = Number(await this.escrow.jobBalance(sampleJob1.id));

      assert.equal(newJobBalance, 0);
      assert.equal(originalMinerBalance1 + (originalJobBalance / 4), newMinerBalance1);
      assert.equal(originalMinerBalance2 + (originalJobBalance / 4), newMinerBalance2);
      assert.equal(originalMinerBalance3 + (originalJobBalance / 4), newMinerBalance3);
      assert.equal(originalMinerBalance4 + (originalJobBalance / 4), newMinerBalance4);
    });
  });
});
