// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// IMPLEMENTATION STORAGE
// slot 0 = vulnerableAddress
// slot 1 = someData
contract Level5_Implementation {
    address public vulnerableAddress; // Collides with slot 0
    uint256 public someData;          // Collides with slot 1

    function updateAddress(address _newAddress) external {
        vulnerableAddress = _newAddress;
    }
}

// PROXY STORAGE
// slot 0 = owner
// slot 1 = implementation
contract Level5_ProxyVault {
    address public owner;
    address public implementation;

    constructor(address _implementation) payable {
        require(msg.value == 0.05 ether, "Requires exactly 0.05 ETH to setup");
        owner = msg.sender;
        implementation = _implementation;
    }

    // Vulnerable endpoint
    function execute(bytes calldata data) external {
        // VULNERABILITY: 
        // delegatecall executes the implementation's code against THIS contract's storage.
        // Because the implementation writes to slot 0 (vulnerableAddress), it will
        // accidentally overwrite slot 0 (owner) in this contract.
        (bool success, ) = implementation.delegatecall(data);
        require(success, "Delegatecall failed");
    }

    function withdraw(address payable recipient) external {
        require(msg.sender == owner, "Not owner");
        recipient.transfer(address(this).balance);
    }
    
    function isComplete() external view returns (bool) {
        return address(this).balance == 0;
    }
}
