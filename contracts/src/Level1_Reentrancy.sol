// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Level1_Reentrancy {
    mapping(address => uint256) public balances;
    
    constructor() payable {
        balances[address(this)] = msg.value;
    }

    function donate(address _to) external payable {
        balances[_to] += msg.value;
    }

    function withdraw() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "No balance");

        // VULNERABILITY: External call executes before state update
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");

        balances[msg.sender] = 0; 
    }
    
    function isComplete() external view returns (bool) {
        return address(this).balance == 0;
    }
}