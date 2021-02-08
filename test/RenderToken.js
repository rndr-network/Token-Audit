const { BN } = web3.utils;
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

contract('Render Token ', (accounts) => {
  const owner = accounts[0];
  const childChainManagerProxy = accounts[1];

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

    // Create and initialize Render Token contract
    renderToken = await deployProxy(RenderToken, [owner, childChainManagerProxy, name, symbol]);
    renderTokenAddress = await renderToken.address;

    // Create and initialize Escrow contract
    escrow = await deployProxy(Escrow, [owner, renderToken.address]);
    escrowAddress = await escrow.address;

    // Add funds to accounts
    let amount = 100 * renderTokenDecimalFactor;
    for (let account of accounts) {
      await renderToken.deposit(account, abi.encodeParameter('uint256', amount.toString()), {from: childChainManagerProxy})
    }

    // Set escrow contract address
    await renderToken.setEscrowContractAddress(escrowAddress);
  });

  describe('Should allow valid transfers of RNDR tokens', () => {

    it('should return correct balances after transfer', async () => {
      let startBalance0 = Number(await renderToken.balanceOf(accounts[0]));
      let startBalance1 = Number(await renderToken.balanceOf(accounts[1]));

      let transferAmount = 100;
      await renderToken.transfer(accounts[1], transferAmount);

      let endBalance0 = Number(await renderToken.balanceOf(accounts[0]));
      let endBalance1 = Number(await renderToken.balanceOf(accounts[1]));

      assert.equal(startBalance0 - transferAmount, endBalance0);
      assert.equal(startBalance1 + transferAmount, endBalance1);
    });

    it('should throw an error when trying to transfer more than balance', async () => {
      let sender = accounts[3];
      let balance = Number(await renderToken.balanceOf(sender));

      let transferAmount = balance * 2;

      await renderToken.transfer(accounts[2], transferAmount, {from: sender})
        .should.be.rejectedWith('overflow');
    });

    it('should return correct balances after transfering from another account', async () => {
      let startBalance0 = Number(await renderToken.balanceOf(accounts[0]));
      let startBalance1 = Number(await renderToken.balanceOf(accounts[1]));
      let startBalance2 = Number(await renderToken.balanceOf(accounts[2]));

      let approvalAmount = 100;
      await renderToken.approve(accounts[1], approvalAmount);
      await renderToken.transferFrom(accounts[0], accounts[2], approvalAmount, {from: accounts[1]});

      let endBalance0 = Number(await renderToken.balanceOf(accounts[0]));
      let endBalance1 = Number(await renderToken.balanceOf(accounts[1]));
      let endBalance2 = Number(await renderToken.balanceOf(accounts[2]));

      assert.equal(startBalance0 - approvalAmount, endBalance0);
      assert.equal(startBalance1, endBalance1);
      assert.equal(startBalance2 + approvalAmount, endBalance2);
    });

    it('should throw an error when trying to transfer more than allowed', async () => {
      let approvalAmount = 100;
      await renderToken.approve(accounts[1], approvalAmount);

      await renderToken.transferFrom(accounts[0], accounts[2], (approvalAmount * 2), {from: accounts[1]})
        .should.be.rejectedWith('revert');
    });

    it('should throw an error when trying to transfer to 0x0', async () => {
      await renderToken.transfer("0x0000000000000000000000000000000000000000", 100)
        .should.be.rejectedWith('revert');
    });

    it('should throw an error when trying to transferFrom to 0x0', async () => {
      await renderToken.approve(accounts[1], 100);
      await renderToken.transferFrom(accounts[0], "0x0000000000000000000000000000000000000000", 100, { from: accounts[1] })
        .should.be.rejectedWith('revert');
    });
  });


  describe('Should maintain a record of allowances', () => {

    it('should return the correct allowance amount after approval', async () => {
      await renderToken.approve(accounts[1], 100);
      let allowance = await renderToken.allowance(accounts[0], accounts[1]);

      assert.equal(allowance, 100);
    });

    it('should allow updates to allowances', async () => {
      let startApproval = await renderToken.allowance(accounts[0], accounts[1]);
      assert.equal(startApproval, 0);

      await renderToken.increaseAllowance(accounts[1], 50);
      let postIncrease = await renderToken.allowance(accounts[0], accounts[1]);
      startApproval.add(new BN(50)).should.be.bignumber.equal(postIncrease);

      await renderToken.decreaseAllowance(accounts[1], 10);
      let postDecrease = await renderToken.allowance(accounts[0], accounts[1]);
      postIncrease.sub(new BN(10)).should.be.bignumber.equal(postDecrease);
    });

    it('should increase by 50 then set to 0 by decreasing', async () => {
      let startApproval = await renderToken.allowance(accounts[0], accounts[1]);
      assert.equal(startApproval, 0);

      await renderToken.approve(accounts[1], 50);
      await renderToken.decreaseAllowance(accounts[1], 50);

      let postDecrease = await renderToken.allowance(accounts[0], accounts[1]);
      postDecrease.should.be.bignumber.equal("0");
    });
  });

  describe('Should allow tokens to be escrowed', () => {

    it('should remove tokens from calling address', async () => {
      let startBalance = await renderToken.balanceOf(accounts[1]);
      await renderToken.holdInEscrow('userId', startBalance, {from: accounts[1]});

      let endBalance = await renderToken.balanceOf(accounts[1]);
      assert.equal(endBalance, 0);
    });
  });
});
