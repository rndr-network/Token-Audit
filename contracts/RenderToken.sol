pragma solidity ^0.4.24;

// Escrow constract
import "./Escrow.sol";
import "./MigratableERC20.sol";

/**
 * @title RenderToken
 * @dev ERC20 mintable token
 * The token will be minted by the crowdsale contract only
 */
contract RenderToken is Migratable, MigratableERC20, MintableToken {

  string public constant name = "Render Token";
  string public constant symbol = "RNDR";
  uint8 public constant decimals = 18;

  // The address of the contract that manages job balances. Address is used for forwarding tokens
  // that come in to fund jobs
  address public escrowContractAddress;

  // Emit new contract address when escrowContractAddress has been changed
  event EscrowContractAddressUpdate(address escrowContractAddress);

  // Emit information related to tokens being escrowed
  event TokensEscrowed(address sender, string jobId, uint256 amount);

  /**
   * @dev Initailization
   * @param _owner because this contract uses proxies, owner must be passed in as a param
   */
  function initialize(address _owner, address _legacyToken) public isInitializer("RenderToken", "0") {
    MintableToken.initialize(_owner);
    MigratableERC20.initialize(_legacyToken);
  }

  /**
   * @dev Take tokens prior to beginning a job
   *
   * This function is called by the artist, and it will transfer tokens
   * to a separate escrow contract to be held until the job is completed
   * @param _jobID is the ID of the job used within the ORC backend
   * @param _amount is the number of RNDR tokens being held in escrow
   */
  function holdInEscrow(string _jobID, uint256 _amount) public {
    require(transfer(escrowContractAddress, _amount), "token transfer to escrow address failed");
    Escrow(escrowContractAddress).fundJob(_jobID, _amount);

    emit TokensEscrowed(msg.sender, _jobID, _amount);
  }

  function _mint(address _to, uint256 _amount) internal {
    require(_to != address(0), "_to address must not be null");
    totalSupply_ = totalSupply_.add(_amount);
    balances[_to] = balances[_to].add(_amount);

    emit Transfer(address(0), _to, _amount);
  }

  /**
   * @dev Set the address of the escrow contract
   *
   * This will dictate the contract that will hold tokens in escrow and keep
   * a ledger of funds available for jobs
   * @param _escrowAddress see escrowContractAddress
  */
  function setEscrowContractAddress(address _escrowAddress) public onlyOwner {
    require(_escrowAddress != address(0), "_escrowAddress must not be null");
    escrowContractAddress = _escrowAddress;

    emit EscrowContractAddressUpdate(escrowContractAddress);
  }

}
