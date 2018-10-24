
const BigNumber = web3.BigNumber;
const Escrow = artifacts.require('Escrow');
const LegacyToken = artifacts.require('LegacyToken');
const RenderToken = artifacts.require('RenderToken');

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();


contract('Render Token ', (accounts) => {

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

  describe('Should allow valid transfers of RNDR tokens', () => {

    it('should return correct balances after transfer', async () => {
      let startBalance0 = Number(await this.renderToken.balanceOf(accounts[0]));
      let startBalance1 = Number(await this.renderToken.balanceOf(accounts[1]));

      let transferAmount = 100;
      await this.renderToken.transfer(accounts[1], transferAmount);

      let endBalance0 = Number(await this.renderToken.balanceOf(accounts[0]));
      let endBalance1 = Number(await this.renderToken.balanceOf(accounts[1]));

      assert.equal(startBalance0 - transferAmount, endBalance0);
      assert.equal(startBalance1 + transferAmount, endBalance1);
    });

    it('should throw an error when trying to transfer more than balance', async () => {
      let sender = accounts[3];
      let balance = Number(await this.renderToken.balanceOf(sender));

      let transferAmount = balance * 2;

      await this.renderToken.transfer(accounts[2], transferAmount, {from: sender})
        .should.be.rejectedWith('revert');
    });

    it('should return correct balances after transfering from another account', async () => {
      let startBalance0 = Number(await this.renderToken.balanceOf(accounts[0]));
      let startBalance1 = Number(await this.renderToken.balanceOf(accounts[1]));
      let startBalance2 = Number(await this.renderToken.balanceOf(accounts[2]));

      let approvalAmount = 100;
      await this.renderToken.approve(accounts[1], approvalAmount);
      await this.renderToken.transferFrom(accounts[0], accounts[2], approvalAmount, {from: accounts[1]});

      let endBalance0 = Number(await this.renderToken.balanceOf(accounts[0]));
      let endBalance1 = Number(await this.renderToken.balanceOf(accounts[1]));
      let endBalance2 = Number(await this.renderToken.balanceOf(accounts[2]));

      assert.equal(startBalance0 - approvalAmount, endBalance0);
      assert.equal(startBalance1, endBalance1);
      assert.equal(startBalance2 + approvalAmount, endBalance2);
    });

    it('should throw an error when trying to transfer more than allowed', async () => {
      let approvalAmount = 100;
      await this.renderToken.approve(accounts[1], approvalAmount);

      await this.renderToken.transferFrom(accounts[0], accounts[2], (approvalAmount * 2), {from: accounts[1]})
        .should.be.rejectedWith('revert');
    });

    it('should throw an error when trying to transfer to 0x0', async () => {
      await this.renderToken.transfer(0x0, 100)
        .should.be.rejectedWith('revert');
    });

    it('should throw an error when trying to transferFrom to 0x0', async () => {
      await this.renderToken.approve(accounts[1], 100);
      await this.renderToken.transferFrom(accounts[0], 0x0, 100, { from: accounts[1] })
        .should.be.rejectedWith('revert');
    });
  });


  describe('Should maintain a record of allowances', () => {

    it('should return the correct allowance amount after approval', async () => {
      await this.renderToken.approve(accounts[1], 100);
      let allowance = await this.renderToken.allowance(accounts[0], accounts[1]);

      assert.equal(allowance, 100);
    });

    it('should allow updates to allowances', async () => {
      let startApproval = await this.renderToken.allowance(accounts[0], accounts[1]);
      assert.equal(startApproval, 0);

      await this.renderToken.increaseApproval(accounts[1], 50);
      let postIncrease = await this.renderToken.allowance(accounts[0], accounts[1]);
      startApproval.plus(50).should.be.bignumber.equal(postIncrease);

      await this.renderToken.decreaseApproval(accounts[1], 10);
      let postDecrease = await this.renderToken.allowance(accounts[0], accounts[1]);
      postIncrease.minus(10).should.be.bignumber.equal(postDecrease);
    });

    it('should increase by 50 then set to 0 when decreasing by more than 50', async () => {
      let startApproval = await this.renderToken.allowance(accounts[0], accounts[1]);
      assert.equal(startApproval, 0);

      await this.renderToken.approve(accounts[1], 50);
      await this.renderToken.decreaseApproval(accounts[1], 60);

      let postDecrease = await this.renderToken.allowance(accounts[0], accounts[1]);
      postDecrease.should.be.bignumber.equal(0);
    });

  });

});
