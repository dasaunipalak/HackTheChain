// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ITRCReceiver {
    function onTRCReceived(uint256 amount) external;
}

contract Level1_Reentrancy {
    IERC20 public immutable trace;

    mapping(address => uint256) public balances;

    uint256 public constant VAULT_AMOUNT = 100 ether;

    constructor(address _trace) {
        trace = IERC20(_trace);
    }

    function deposit(uint256 amount) external {
        require(
            amount > 0,
            "Amount must be greater than zero"
        );

        bool success = trace.transferFrom(
            msg.sender,
            address(this),
            amount
        );

        require(
            success,
            "Transfer failed"
        );

        balances[msg.sender] += amount;
    }

    function withdraw() external {
        uint256 amount = balances[msg.sender];

        require(
            amount > 0,
            "No balance"
        );

        // Vulnerability:
        // TRC is transferred before the balance is cleared.
        bool success = trace.transfer(
            msg.sender,
            amount
        );

        require(
            success,
            "Transfer failed"
        );

        // If the recipient is a contract,
        // give it a chance to call withdraw() again.
        if (msg.sender.code.length > 0) {
            ITRCReceiver(msg.sender).onTRCReceived(amount);
        }

        // Too late!
        balances[msg.sender] = 0;
    }

    function isComplete()
        external
        view
        returns (bool)
    {
        return trace.balanceOf(address(this)) == 0;
    }
}