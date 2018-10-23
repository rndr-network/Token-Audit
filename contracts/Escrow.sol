pragma solidity ^0.4.24;

import { Migratable } from "../node_modules/zos-lib/contracts/migrations/Migratable.sol";
import { Ownable } from "../node_modules/openzeppelin-zos/contracts/ownership/Ownable.sol";
import { SafeMath } from "../node_modules/openzeppelin-zos/contracts/math/SafeMath.sol";
import { StandardToken } from "../node_modules/openzeppelin-zos/contracts/token/ERC20/StandardToken.sol";

/**
 * @title Escrow
 * @dev Escrow contract that works with RNDR token
 * This contract holds tokens while render jobs are being completed
 * and information on token allottment per job
 */
contract Escrow is Migratable, Ownable {
  using SafeMath for uint256;

  // This is a mapping of job IDs to the number of tokens allotted to the job
  mapping(string => uint256) private jobBalances;
  // This is the address of the render token contract
  address public renderTokenAddress;
  // This is the address with authority to call the disburseJob function
  address public disbursalAddress;

  // Emit new disbursal address when disbursalAddress has been changed
  event DisbursalAddressUpdate(address disbursalAddress);
  // Emit the jobId along with the new balance of the job
  // Used on job creation, additional funding added to jobs, and job disbursal
  // Internal systems for assigning jobs will watch this event to determine balances available
  event JobBalanceUpdate(string _jobId, uint256 _balance);
  // Emit new contract address when renderTokenAddress has been changed
  event RenderTokenAddressUpdate(address renderTokenAddress);

  /**
   * @dev Modifier to check if the message sender can call the disburseJob function
   */
  modifier canDisburse() {
    require(msg.sender == disbursalAddress, "message sender not authorized to disburse funds");
    _;
  }

  /**
   * @dev Initailization
   * @param _owner because this contract uses proxies, owner must be passed in as a param
   * @param _renderTokenAddress see renderTokenAddress
   */
  function initialize (address _owner, address _renderTokenAddress) public isInitializer("Escrow", "0") {
    Ownable.initialize(_owner);
    disbursalAddress = _owner;
    renderTokenAddress = _renderTokenAddress;
  }

  /**
   * @dev Change the address authorized to distribute tokens for completed jobs
   *
   * Because there are no on-chain details to indicate who performed a render, an outside
   * system must call the disburseJob function with the information needed to properly
   * distribute tokens. This function updates the address with the authority to perform distributions
   * @param _newDisbursalAddress see disbursalAddress
   */
  function changeDisbursalAddress(address _newDisbursalAddress) external onlyOwner {
    disbursalAddress = _newDisbursalAddress;

    emit DisbursalAddressUpdate(disbursalAddress);
  }

  /**
   * @dev Change the address allowances will be sent to after job completion
   *
   * Ideally, this will not be used, but is included as a failsafe.
   * If the RNDR token contract is ever migrated to another address for
   * either added security or functionality, this will need to be called.
   * @param _newRenderTokenAddress see renderTokenAddress
   */
  function changeRenderTokenAddress(address _newRenderTokenAddress) external onlyOwner {
    require(_newRenderTokenAddress != address(0), "_newRenderTokenAddress must not be null");
    renderTokenAddress = _newRenderTokenAddress;

    emit RenderTokenAddressUpdate(renderTokenAddress);
  }

  /**
   * @dev Send allowances to node(s) that performed a job
   *
   * This can only be called by the disbursalAddress, an accound owned
   * by OTOY, and it provides the number of tokens to send to each node
   * @param _jobId the ID of the job used in the jobBalances mapping
   * @param _recipients the address(es) of the nodes that performed rendering
   * @param _amounts the amount(s) to send to each address. These must be in the same
   * order as the recipient addresses
   */
  function disburseJob(string _jobId, address[] _recipients, uint256[] _amounts) external canDisburse {
    require(jobBalances[_jobId] > 0, "_jobId has no available balance");

    for(uint256 i = 0; i < _recipients.length; i++) {
      jobBalances[_jobId] = jobBalances[_jobId].sub(_amounts[i]);
      StandardToken(renderTokenAddress).transfer(_recipients[i], _amounts[i]);
    }

    emit JobBalanceUpdate(_jobId, jobBalances[_jobId]);
  }

  /**
   * @dev Add RNDR tokens to a job
   *
   * This can only be called by a function on the RNDR token contract
   * @param _jobId the ID of the job used in the jobBalances mapping
   * @param _tokens the number of tokens sent by the artist to fund the job
   */
  function fundJob(string _jobId, uint256 _tokens) external {
    // Jobs can only be created through the user / contract at
    // the address stored in renderTokenAddress
    require(msg.sender == renderTokenAddress, "message sender not authorized");
    jobBalances[_jobId] = jobBalances[_jobId].add(_tokens);

    emit JobBalanceUpdate(_jobId, jobBalances[_jobId]);
  }

  /**
   * @dev See the tokens available for a job
   *
   * @param _jobId the ID used to lookup the job balance
   */
  function jobBalance(string _jobId) external view returns(uint256) {
    return jobBalances[_jobId];
  }

}
