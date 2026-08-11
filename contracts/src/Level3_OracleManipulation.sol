// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./MockToken.sol";
import "./SimpleAMM.sol";
import "./VulnerableOracle.sol";

contract Level3_OracleManipulation {
    MockToken public token;
    SimpleAMM public amm;
    VulnerableOracle public oracle;

    mapping(address => uint256) public collateral;
    mapping(address => uint256) public borrowed;

    // The vault is funded with 0.1 ETH during construction.
    constructor() payable {
        require(msg.value == 0.11 ether, "Requires exactly 0.11 ETH to setup"); // 0.1 ETH for vault, 0.01 for AMM

        // Deploy token
        token = new MockToken(2000 ether); // 2000 MKT total supply

        // Deploy AMM and fund it with 0.01 ETH
        amm = new SimpleAMM{value: 0.01 ether}(token);
        
        // Give AMM 1000 MKT
        token.approve(address(amm), 1000 ether);
        amm.init(1000 ether);

        // Deploy Oracle
        oracle = new VulnerableOracle(amm);
    }

    // Airdrop for the player to get starting collateral (1000 MKT)
    function claimAirdrop() external {
        require(collateral[msg.sender] == 0 && token.balanceOf(msg.sender) == 0, "Already claimed");
        token.transfer(msg.sender, 1000 ether);
    }

    function deposit(uint256 amount) external {
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        collateral[msg.sender] += amount;
    }

    function borrow(uint256 borrowAmount) external {
        uint256 price = oracle.getPrice(); // ETH per 1 MKT (1e18)
        
        // Calculate collateral value in ETH
        uint256 collateralValueInETH = (collateral[msg.sender] * price) / 1e18;
        
        // 75% LTV
        uint256 maxBorrow = (collateralValueInETH * 75) / 100;
        require(borrowed[msg.sender] + borrowAmount <= maxBorrow, "Insufficient collateral");

        borrowed[msg.sender] += borrowAmount;
        
        (bool success, ) = msg.sender.call{value: borrowAmount}("");
        require(success, "Transfer failed");
    }

    function isComplete() external view returns (bool) {
        // Vault starts with 0.1 ETH.
        // It's considered drained if it has 0 ETH.
        return address(this).balance == 0;
    }
}
