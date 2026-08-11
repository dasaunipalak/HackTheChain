// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Level1_AccessControl {
    address public owner;

    constructor() payable {
        owner = msg.sender;
    }

    function withdrawAll(address payable recipient) external {
        // INTENDED SECURITY MODEL:
        // Only the owner should be able to withdraw.
        //
        // VULNERABILITY:
        // There is NO access-control check.
        recipient.transfer(address(this).balance);
    }

    function isComplete() external view returns (bool) {
        return address(this).balance == 0;
    }
}
